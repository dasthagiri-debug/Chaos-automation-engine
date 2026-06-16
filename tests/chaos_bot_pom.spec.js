const { test, expect } = require('@playwright/test');
const WebinarRoom = require('../Pages/WebinarRoom');

test.describe.configure({ mode: 'parallel' }); 

const isEnabled = (value) => ['1', 'true', 'yes', 'on'].includes((value || '').toLowerCase());
const SMOKE_MODE = isEnabled(process.env.CHAOS_SMOKE_MODE);
const TOTAL_BOTS = SMOKE_MODE ? 1 : parseInt(process.env.BOT_COUNT || '40');
const SMOKE_WAIT_MS = parseInt(process.env.CHAOS_SMOKE_WAIT_MS || '2000', 10);
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

test.setTimeout(45 * 60 * 1000); 

for (let i = 1; i <= TOTAL_BOTS; i++) {
    test(`Chaos Bot: Profile ${i} - Full Resilient Lifecycle`, async ({ page }, testInfo) => {
        
        const containerId = process.env.CONTAINER_ID || Math.floor(Math.random() * 90000) + 10000;
        const runId = Date.now().toString(36).slice(-5);
        const botName = `Bot ${containerId}-${runId}-${i}`;
        const botEmail = `bot${containerId}_${runId}_${i}@test.com`;
        const attendeeUrl = process.env.BASE_URL || 'https://dasta133.easywebinar.live/live-event-161';
        if (!process.env.BASE_URL) {
            console.warn(`[Bot-${i}] BASE_URL not set, falling back to hardcoded URL.`);
        }
        
        const webinar = new WebinarRoom(page);
        let isJoined = false;

        // Connection tracing — surfaces socket drops and server-side redirects in logs
        // so we can correlate missed poll clicks with server-side events.
        page.on('websocket', ws => {
            console.log(`[${botName}] [BOT SOCKET OPEN] ${ws.url()}`);
            ws.on('close', () => console.log(`[${botName}] [BOT SOCKET CLOSED] ${ws.url()}`));
            ws.on('socketerror', err => console.log(`[${botName}] [BOT SOCKET ERROR] ${ws.url()} — ${err}`));
        });
        page.on('framenavigated', frame => {
            if (frame === page.mainFrame()) {
                console.log(`[${botName}] [BOT REDIRECT/RELOAD] → ${frame.url()}`);
            }
        });

        // =====================================================================
        // PHASE 1: RESILIENT JOIN & STAGGERED ENTRY
        // =====================================================================
        try {
            // Global stagger: each container waits 30s × (CONTAINER_ID - 1) before its first
            // bot fires, then bots within it space 1.5s apart.
            // Result: ~1 bot joins per 1.5s across all 10 containers — ~6-minute ramp for 400 bots.
            // Without this, all containers start simultaneously and 10 bots collide every 3s.
            const containerOffset = SMOKE_MODE ? 0 : (parseInt(containerId) - 1) * 30000;
            const staggerDelay = SMOKE_MODE ? 500 : containerOffset + (i * 1500);
            console.log(`[BOT-${i}] ▶ STARTING | name="${botName}" | container_offset=${containerOffset / 1000}s | bot_delay=${(i * 1500) / 1000}s | total_stagger=${staggerDelay / 1000}s`);
            await page.waitForTimeout(staggerDelay);

            await webinar.joinWebinar(attendeeUrl, botName, botEmail, {
                maxRetries: 3,
                retryDelayMs: 5000,
                testInfo,
                botLabel: `Bot-${i}`
            });

            isJoined = true;
            console.log(`[BOT-${i}] ✅ JOINED | ${botName}`);
        } catch (error) {
            console.error(`[BOT-${i}] ❌ FAILED TO JOIN | ${botName} | reason: ${error.message}`);
            await page.screenshot({ path: `test-results/fail-bot-${i}.png` }).catch(e => console.error(`[BOT-${i}] Screenshot failed: ${e.message}`));
            throw new Error(`Bot ${i} could not join after retries. Reason: ${error.message}`);
        }

        if (isJoined) {
            if (SMOKE_MODE) {
                testInfo.annotations.push({
                    type: 'smoke-mode',
                    description: `Join-only smoke validation passed for ${botName}`
                });
                console.log(`[${botName}] Smoke mode active. Join verified; exiting early.`);
                await page.waitForTimeout(SMOKE_WAIT_MS);
                return;
            }

            // =====================================================================
            // PHASE 2: INITIAL CHAT GREETING
            // =====================================================================
            await webinar.sendChat(`Hello Admin, ${botName} reporting in!`);
            console.log(`[${botName}] ✓ Initial greeting sent.`);
            await page.waitForTimeout(2000);

            // =====================================================================
            // PHASE 3: INITIAL QUESTION
            // =====================================================================
            await webinar.askQuestion(`Is there a replay available? Asking for ${botName}.`);
            console.log(`[${botName}] ✓ Initial question asked.`);
            await page.waitForTimeout(2000);

            // =====================================================================
            // PHASE 4: DELETE CHAT TEST
            // =====================================================================
            try {
                const delText = `Temp msg from ${botName} 🗑️`;
                await webinar.sendChat(delText);
                await page.waitForTimeout(3000);
                const msg = webinar.getMessageByText(delText);
                await webinar.deleteMessage(msg);
                console.log(`[${botName}] ✓ Chat deletion test passed.`);
            } catch (e) { console.log(`[${botName}] ⚠ Chat delete failed: ${e.message}`); }

            // =====================================================================
            // PHASE 5: DELETE QUESTION TEST
            // =====================================================================
            try {
                const delQText = `Question from ${botName} to be deleted.`;
                await webinar.askQuestion(delQText);
                await page.waitForTimeout(3000);
                const q = webinar.getQuestionByText(delQText);
                await webinar.deleteQuestion(q);
                console.log(`[${botName}] ✓ Question deletion test passed.`);
            } catch (e) { console.log(`[${botName}] ⚠ Question delete failed: ${e.message}`); }

            // =====================================================================
            // PHASE 6: REACT & REPLY TEST
            // =====================================================================
            try {
                await webinar.switchToChat();
                await page.waitForTimeout(1500);
                const latestMsg = webinar.messageBox.first();
                if (await latestMsg.isVisible()) {
                    await webinar.reactToMessage(latestMsg);
                    await webinar.replyToMessage(latestMsg, 'Agree with this! 🚀');
                    console.log(`[${botName}] ✓ Reacted & Replied successfully.`);
                }
            } catch (e) { console.log(`[${botName}] ⚠ Phase 6 action skipped: ${e.message}`); }

            // =====================================================================
            // PHASE 7: INFINITE OMNI-ENGAGEMENT LOOP
            // =====================================================================
            // All bots answer polls — previously 50% had poll monitoring disabled,
            // causing near-zero poll responses even with hundreds of bots in the room.
            // Offers kept at 50% since offer clicks open popups and are non-critical.
            const willOffer = Math.random() < 0.5;
            webinar.startBackgroundMonitors(botName, true, willOffer);

            const chatMessages = ["That makes sense.", "Great point!", "Love this! 🚀", "🔥", "Agreed."];
            const qaQuestions = ["How does this scale?", "Will slides be shared?", "Any doc links?"];

            console.log(`[${botName}] ♾️ Entering Infinite Loop...`);
            
            while (await webinar.isInLiveRoom()) {
                const waitTime = randomDelay(8000, 15000);
                console.log(`[${botName}] ⏳ Heartbeat: Standing by for ${Math.round(waitTime / 1000)}s...`);
                await page.waitForTimeout(waitTime);

                if (!(await webinar.isInLiveRoom())) break;

                const diceRoll = Math.random();
                try {
                    if (diceRoll < 0.35) {
                        const msg = chatMessages[Math.floor(Math.random() * chatMessages.length)];
                        await webinar.sendChat(msg);
                        console.log(`[${botName}] 💬 Sent Chat: "${msg}"`);
                    } else if (diceRoll < 0.65) {
                        const qTxt = qaQuestions[Math.floor(Math.random() * qaQuestions.length)];
                        await webinar.askQuestion(qTxt);
                        console.log(`[${botName}] ❓ Asked Question: "${qTxt}"`);
                    } else if (diceRoll < 0.85) {
                        await webinar.switchToChat();
                        const latest = webinar.messageBox.last();
                        if (await latest.isVisible()) {
                            await latest.scrollIntoViewIfNeeded();
                            await webinar.reactToMessage(latest);
                            console.log(`[${botName}] ❤️ Reacted to last message.`);
                        }
                    } else {
                        console.log(`[${botName}] ☕ Idle.`);
                    }
                } catch (loopError) {
                    console.log(`[${botName}] ⚠ Loop action skipped: ${loopError.message}`);
                }
            }
        }
        console.log(`[${botName}] Session ended.`);
    });
}