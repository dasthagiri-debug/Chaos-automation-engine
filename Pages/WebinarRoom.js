/**
 * WebinarRoom Page Object Model
 * Centralizes all Playwright locators for the webinar live room.
 * Fully optimized for Headless Container Execution.
 */
class WebinarRoom {
    constructor(page) {
        this.page = page;

        // --- JOIN/ENTRY ELEMENTS ---
        this.fullNameField = page.locator('input[placeholder*="Full Name" i], input[name*="name" i], input[type="text"]').first();
        this.emailField = page.locator('input[placeholder*="Email" i], input[type="email"], input[name*="email" i]').first();
        this.joinSubmitButton = page.locator('button[type="submit"], input[type="submit"], button').filter({ hasText: /join|register|enter|submit|watch/i }).first();
        this.soundOverlay = page.getByText(/click for sound/i).first();

        // --- TAB NAVIGATION ---
        this.chatTab = page.locator('a, button, div.tab-item').filter({ hasText: /^Chat$/i }).first();
        this.questionTab = page.locator('a, button, div.tab-item').filter({ hasText: /Question|Q&A/i }).first();
        this.peopleTab = page.locator('a, button').filter({ hasText: /People/i }).first();

        // --- CHAT ELEMENTS ---
        this.chatInput = page.locator('input[placeholder*="message" i], input[placeholder*="chat" i], textarea[placeholder*="message" i], textarea[placeholder*="type" i], [contenteditable="true"]').first();
        this.messageBox = page.locator('.flex.message-box');
        this.emojiReactionBar = page.locator('.emoji-reaction-bar');
        this.emojiButton = page.locator('.emoji-btn').filter({ hasText: '👏' });
        this.chatDeleteConfirmButton = page.locator('button.warning-button').filter({ hasText: /^Delete$/i }).first();

        // --- QUESTION/Q&A ELEMENTS ---
        this.askQuestionButton = page.getByRole('button', { name: /Ask a Question/i }).first();
        this.questionInput = page.getByPlaceholder('Type your question..');
        this.submitQuestionButton = page.getByRole('button', { name: /Submit Question/i });
        this.questionDeleteButton = page.locator('.delete-popup-area button').filter({ hasText: /^Delete$/i }).first();

        // --- POLL & OFFER ELEMENTS ---
        this.pollContainer = page.locator('div').filter({ hasText: /Active Poll|^Poll$/i }).last();
        this.pollSubmitButton = this.pollContainer.getByRole('button', { name: /Submit/i });
        this.offerContainer = page.locator('div').filter({ hasText: /Active Offer|^Offer$/i }).last();
        this.offerActionElement = this.offerContainer.locator('button, a').first();
    }

    // =====================================================================
    // CORE ACTIONS (HEADLESS OPTIMIZED)
    // =====================================================================

    async joinWebinar(url, name, email, options = {}) {
        const {
            maxRetries = 4,
            retryDelayMs = 8000,
            testInfo,
            botLabel = name
        } = options;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Fresh email per attempt to avoid ERR_TOO_MANY_REDIRECTS on retry
                const attemptEmail = attempt > 1
                    ? email.replace('@', `_r${attempt}@`)
                    : email;

                console.log(`[${botLabel}] ⏳ Attempt ${attempt}/${maxRetries}: navigating to room... (email: ${attemptEmail})`);
                await this.page.setViewportSize({ width: 1920, height: 1080 });
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // Wait for registration form
                await this.fullNameField.waitFor({ state: 'visible', timeout: 45000 });
                console.log(`[${botLabel}] Attempt ${attempt}: form visible, filling details...`);
                await this.fullNameField.fill(name);
                await this.emailField.fill(attemptEmail);

                // Explicit submit button click; fall back to Enter if button not found
                const submitVisible = await this.joinSubmitButton.isVisible().catch(() => false);
                if (submitVisible) {
                    await this.joinSubmitButton.click({ timeout: 10000 });
                } else {
                    await this.emailField.press('Enter');
                }

                console.log(`[${botLabel}] Attempt ${attempt}: form submitted, waiting for URL redirect...`);
                await this.page.waitForURL(/\/live-room\/attendee/i, { timeout: 180000 });
                console.log(`[${botLabel}] Attempt ${attempt}: URL reached, waiting for room UI...`);

                // Wait for configuring overlay to disappear — use separate locators to avoid
                // broken mixed text=/css selector syntax (non-existent elements resolve hidden instantly)
                const overlayByText = this.page.getByText(/configuring webinar room/i).first();
                const overlayByCss = this.page.locator('.loader, .loading-overlay, .spinner, [class*="loading-"], [class*="configuring"]').first();

                const overlayTextGone = await overlayByText.waitFor({ state: 'hidden', timeout: 120000 }).then(() => true).catch(() => true);
                const overlayCssGone = await overlayByCss.waitFor({ state: 'hidden', timeout: 45000 }).then(() => true).catch(() => true);
                console.log(`[${botLabel}] Attempt ${attempt}: overlay cleared — text=${overlayTextGone}, css=${overlayCssGone}`);

                // Chat tab visibility is the definitive signal that the room is ready
                const chatReady = await this.chatTab.waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
                console.log(`[${botLabel}] Attempt ${attempt}: chatTab visible=${chatReady}`);

                if (!chatReady) {
                    // Room UI never appeared — likely still stuck on overlay; force a retry
                    throw new Error(`Room UI not ready — chatTab never appeared after overlay wait (attempt ${attempt})`);
                }

                if (await this.soundOverlay.isVisible().catch(() => false)) {
                    await this.soundOverlay.click({ force: true });
                }

                console.log(`[${botLabel}] ✅ JOIN SUCCESS (attempt ${attempt})`);
                return;
            } catch (error) {
                const description = `${botLabel} join attempt ${attempt}/${maxRetries} failed: ${error.message}`;
                console.warn(`[${botLabel}] ⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

                if (testInfo) {
                    testInfo.annotations.push({ type: 'join-failure', description });
                }

                if (attempt === maxRetries) {
                    console.error(`[${botLabel}] ❌ JOIN FAILED after ${maxRetries} attempts: ${error.message}`);
                    throw new Error(`Join failed after ${maxRetries} attempts for ${botLabel}: ${error.message}`);
                }

                console.log(`[${botLabel}] 🔄 Retrying in ${retryDelayMs / 1000}s...`);
                await this.page.waitForTimeout(retryDelayMs);
            }
        }
    }

    async switchToChat() {
        await this.chatTab.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        await this.chatTab.click({ force: true }).catch(() => this.chatTab.evaluate(el => el.click()));
    }

    async switchToQuestion() {
        await this.questionTab.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        await this.questionTab.click({ force: true }).catch(() => this.questionTab.evaluate(el => el.click()));
    }

    async sendChat(message) {
        if (!(await this.chatInput.isVisible())) {
            await this.switchToChat();
            await this.page.waitForTimeout(1000);
        }
        await this.chatInput.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        await this.chatInput.evaluate(el => el.focus()).catch(() => {});
        
        await this.page.keyboard.press('Escape').catch(() => {}); 
        await this.chatInput.click({ force: true }).catch(() => {}); 
        
        await this.chatInput.pressSequentially(message, { delay: 50 });
        await this.page.keyboard.press('Enter');
    }

    async askQuestion(questionText) {
        if (!(await this.askQuestionButton.isVisible())) {
            await this.switchToQuestion();
            await this.page.waitForTimeout(1500);
        }
        if (await this.askQuestionButton.isVisible()) {
            await this.askQuestionButton.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
            await this.askQuestionButton.click({ force: true, timeout: 10000 }).catch(() => {});
            await this.questionInput.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
            if (await this.questionInput.isVisible().catch(() => false)) {
                await this.questionInput.fill(questionText);
                await this.submitQuestionButton.click({ timeout: 10000 }).catch(() => {});
            }
        }
    }

    async reactToMessage(messageElement) {
        await messageElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        // DOM confirmed: .emoji-reaction-bar > span.emoji-btn are always present inside .chat-action
        const clapEmoji = messageElement.locator('.chat-action .emoji-reaction-bar .emoji-btn').filter({ hasText: '👏' }).first();
        await clapEmoji.evaluate(el => el.click()).catch(async () => await clapEmoji.click({ force: true }).catch(() => {}));
    }

    async replyToMessage(messageElement, replyText) {
        await messageElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        // DOM confirmed: a.reply-chat is always present inside .chat-action
        const replyBtn = messageElement.locator('.chat-action a.reply-chat').first();
        await replyBtn.evaluate(el => el.click()).catch(async () => await replyBtn.click({ force: true }).catch(() => {}));
        await this.page.waitForTimeout(1000);
        await this.chatInput.click({ force: true }).catch(() => {});
        await this.chatInput.pressSequentially(replyText, { delay: 50 });
        await this.page.keyboard.press('Enter');
    }

    async deleteMessage(messageElement) {
        if (!(await messageElement.isVisible().catch(() => false))) return;

        await messageElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        await messageElement.dispatchEvent('mouseenter').catch(() => {});
        await messageElement.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500);

        const deleteIcon = messageElement.locator('a.delete-chat').last();
        const iconVisible = await deleteIcon.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!iconVisible) return;

        await deleteIcon.dispatchEvent('click').catch(() => {});
        const confirmVisible = await this.chatDeleteConfirmButton.waitFor({ state: 'attached', timeout: 5000 }).then(() => true).catch(() => false);
        if (confirmVisible) await this.chatDeleteConfirmButton.dispatchEvent('click').catch(() => {});
    }

    async deleteQuestion(questionElement) {
        const exists = await questionElement.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!exists) return;
        await questionElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        await questionElement.evaluate(el => {
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }).catch(() => {});
        await questionElement.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500);

        const crossBtn = questionElement.locator('div.items-start > button, button.delete-question, button[aria-label*="delete" i], button[title*="delete" i]').first();
        const crossVisible = await crossBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!crossVisible) return;

        await crossBtn.dispatchEvent('click').catch(() => {});
        const confirmVisible = await this.questionDeleteButton.waitFor({ state: 'attached', timeout: 5000 }).then(() => true).catch(() => false);
        if (confirmVisible) await this.questionDeleteButton.dispatchEvent('click').catch(() => {});
    }

    getQuestionByText(text) { return this.page.locator('div.mb-4.p-4').filter({ hasText: text }).first(); }
    getMessageByText(text) { return this.page.locator('.flex.message-box').filter({ hasText: text }).last(); }

    // Robust room presence check: confirms the URL still contains live-room AND the page
    // hasn't errored out. A brief WebSocket-triggered state change (co-host join, poll push)
    // can cause a transient URL flicker — we verify twice with a small gap before concluding
    // the bot has actually left, preventing false exits that dropped 395→219 previously.
    async isInLiveRoom() {
        try {
            if (this.page.isClosed()) return false;
            const url = this.page.url();
            if (!url.includes('live-room')) {
                // Transient flicker guard: wait 2s and re-check before giving up
                await this.page.waitForTimeout(2000);
                if (this.page.isClosed()) return false;
                return this.page.url().includes('live-room');
            }
            return true;
        } catch {
            return false;
        }
    }

    // =====================================================================
    // BACKGROUND MONITORS (POLLS & OFFERS)
    // =====================================================================
    
    startBackgroundMonitors(botName, willAnswerPolls = true, willClickOffers = true) {
        if (willAnswerPolls) {
            console.log(`[${botName}] 📡 Poll Radar: ACTIVATED.`);
            this._monitorPolls(botName);
        } else {
            console.log(`[${botName}] 🛑 Poll Radar: DISABLED (Ignoring Polls).`);
        }

        if (willClickOffers) {
            console.log(`[${botName}] 📡 Offer Radar: ACTIVATED.`);
            this._monitorOffers(botName);
        } else {
            console.log(`[${botName}] 🛑 Offer Radar: DISABLED (Ignoring Offers).`);
        }
    }

    async _monitorPolls(botName) {
        // Map<pollText, lastAnsweredMs> — allows re-answering the same poll if
        // the host re-publishes it after >60s (a plain Set would block it forever).
        const answeredPolls = new Map();
        const POLL_COOLDOWN_MS = 60000;
        while (!this.page.isClosed() && await this.isInLiveRoom()) {
            try {
                await this.page.waitForTimeout(2000);

                const pollVisible = await this.pollContainer.isVisible().catch(() => false);
                console.log(`[${botName}] [POLL] radar tick — visible: ${pollVisible}`);
                if (!pollVisible) continue;

                const pollText = await this.pollContainer.innerText().catch(() => 'unknown');
                const lastAnswered = answeredPolls.get(pollText);
                if (lastAnswered && (Date.now() - lastAnswered) < POLL_COOLDOWN_MS) continue;

                const scopedRadios = this.pollContainer.getByRole('radio');
                const radios = await scopedRadios.all();
                if (radios.length === 0) continue;

                const randomRadio = radios[Math.floor(Math.random() * radios.length)];
                await randomRadio.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
                await randomRadio.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
                await randomRadio.evaluate(el => el.click()).catch(async () => await randomRadio.click({ force: true }));
                await this.page.waitForTimeout(1000);

                // Wait for submit button to mount after dynamic overlay renders, then force-click
                // to bypass any animation/layout re-render that intercepts the hit target.
                const submitReady = await this.pollSubmitButton
                    .waitFor({ state: 'visible', timeout: 20000 })
                    .then(() => true)
                    .catch(() => false);

                if (submitReady) {
                    await this.pollSubmitButton
                        .evaluate(el => el.click())
                        .catch(async () => await this.pollSubmitButton.click({ force: true }));
                    console.log(`[${botName}] [POLL] ✓ Voted successfully.`);
                } else {
                    // Submit button never appeared — retry on next radar tick
                    console.log(`[${botName}] [POLL] ⚠ Submit button did not appear, will retry next tick.`);
                    continue;
                }

                await this.peopleTab.evaluate(el => el.click()).catch(async () => await this.peopleTab.click({ force: true }));
                answeredPolls.set(pollText, Date.now());
            } catch (e) {
                if (e.message.includes('closed')) break;
                console.log(`[${botName}] [POLL] ⚠ monitor error: ${e.message}`);
            }
        }
    }

    async _monitorOffers(botName) {
        // Map<offerText, lastClickedMs> — same cooldown pattern as polls so
        // re-published offers are clicked again after >60s.
        const clickedOffers = new Map();
        const OFFER_COOLDOWN_MS = 60000;
        while (!this.page.isClosed() && await this.isInLiveRoom()) {
            try {
                await this.page.waitForTimeout(5000);
                if (await this.offerContainer.isVisible().catch(() => false)) {
                    const offerText = await this.offerContainer.innerText().catch(() => 'unknown');
                    const lastClicked = clickedOffers.get(offerText);
                    if (lastClicked && (Date.now() - lastClicked) < OFFER_COOLDOWN_MS) continue;
                    await this.offerActionElement.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
                    const [newPage] = await Promise.all([
                        this.page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
                        this.offerActionElement.evaluate(el => el.click()).catch(async () => await this.offerActionElement.click({force: true}))
                    ]);
                    if (newPage) await newPage.close().catch(()=>{});
                    await this.peopleTab.evaluate(el => el.click()).catch(async () => await this.peopleTab.click({force: true}));
                    clickedOffers.set(offerText, Date.now());
                    console.log(`[${botName}] [OFFER] ✓ Clicked.`);
                }
            } catch (e) { if (e.message.includes('closed')) break; }
        }
    }
}

module.exports = WebinarRoom;