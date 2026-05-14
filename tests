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
        const botName = `Bot ${containerId}-${i}`;
        const botEmail = `bot${containerId}_${i}@test.com`;
        const attendeeUrl = 'https://dasta133.easywebinar.live/live-event-153';
        
        const webinar = new WebinarRoom(page);
        let isJoined = false;

        // =====================================================================
        // PHASE 1: RESILIENT JOIN & STAGGERED ENTRY
        // =====================================================================
        try {
            const staggerDelay = SMOKE_MODE ? 500 : i * 3000;
            console.log(`[${botName}] Queueing. Waiting ${staggerDelay / 1000}s...`);
            await page.waitForTimeout(staggerDelay);

            console.log(`[${botName}] Join sequence started...`);
            await webinar.joinWebinar(attendeeUrl, botName, botEmail, {
                maxRetries: 2,
                retryDelayMs: 5000,
                testInfo,
                botLabel: `Bot-${i}`
            });

            isJoined = true;
            console.log(`[${botName}] Successfully joined.`);
        } catch (error) {
            console.error(`[${botName}] Join failed: ${error.message}`);
            await page.screenshot({ path: `test-results/fail-${botName}.png` });
            throw new Error(`Bot ${i} could not join after retries.`);
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
            const willPoll = Math.random() < 0.5;
            const willOffer = Math.random() < 0.5;
            webinar.startBackgroundMonitors(botName, willPoll, willOffer);

            const chatMessages = ["That makes sense.", "Great point!", "Love this! 🚀", "🔥", "Agreed."];
            const qaQuestions = ["How does this scale?", "Will slides be shared?", "Any doc links?"];

            console.log(`[${botName}] ♾️ Entering Infinite Loop...`);
            
            while (await webinar.isInLiveRoom()) {
                const waitTime = randomDelay(20000, 45000); 
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