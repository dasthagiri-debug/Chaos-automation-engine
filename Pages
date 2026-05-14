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
        this.pollContainer = page.locator('div').filter({ hasText: 'Active Polls' }).last();
        this.pollSubmitButton = page.getByRole('button', { name: /Submit/i });
        this.offerContainer = page.locator('div').filter({ hasText: 'Active Offers' }).last();
        this.offerActionElement = page.locator('button, a, img').last();
    }

    // =====================================================================
    // CORE ACTIONS (HEADLESS OPTIMIZED)
    // =====================================================================

    async joinWebinar(url, name, email, options = {}) {
        const {
            maxRetries = 2,
            retryDelayMs = 5000,
            testInfo,
            botLabel = name
        } = options;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.page.setViewportSize({ width: 1920, height: 1080 });
                await this.page.goto(url, { waitUntil: 'domcontentloaded' });
                await this.fullNameField.fill(name);
                await this.emailField.fill(email);
                await this.page.keyboard.press('Enter');
                await this.page.waitForURL(/\/live-room\/attendee\?/i, { timeout: 60000 });

                if (await this.soundOverlay.isVisible().catch(() => false)) {
                    await this.soundOverlay.click({ force: true });
                }

                return;
            } catch (error) {
                const description = `${botLabel} join attempt ${attempt}/${maxRetries} failed: ${error.message}`;
                if (testInfo) {
                    testInfo.annotations.push({
                        type: 'join-failure',
                        description
                    });
                }

                if (attempt === maxRetries) {
                    throw new Error(`Join failed after ${maxRetries} attempts for ${botLabel}: ${error.message}`);
                }

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
            await this.askQuestionButton.evaluate(el => el.click()).catch(async () => await this.askQuestionButton.click({ force: true }));
            await this.page.waitForTimeout(1000);
            await this.questionInput.fill(questionText);
            await this.submitQuestionButton.click();
        }
    }

    async reactToMessage(messageElement) {
        await messageElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        
        await messageElement.evaluate(el => {
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }).catch(() => {});
        
        await messageElement.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500); 
        
        const reactionBar = messageElement.locator('.emoji-reaction-bar');
        const clapEmoji = reactionBar.locator('.emoji-btn').filter({ hasText: '👏' }).first();
        
        await clapEmoji.evaluate(el => el.click()).catch(async () => await clapEmoji.click({ force: true }));
    }

    async replyToMessage(messageElement, replyText) {
        await messageElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        
        await messageElement.dispatchEvent('mouseenter').catch(() => {});
        await messageElement.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500); 
        
        const replyBtn = messageElement.locator('a.reply-chat').first();
        
        await replyBtn.dispatchEvent('click').catch(async () => {
            await replyBtn.evaluate(el => {
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                el.click();
            });
        });
        
        await this.page.waitForTimeout(1000);
        
        await this.chatInput.evaluate(el => el.focus()).catch(() => {});
        await this.chatInput.click({ force: true }).catch(() => {}); 
        await this.chatInput.pressSequentially(replyText, { delay: 50 });
        await this.page.keyboard.press('Enter');
    }

    async deleteMessage(messageElement) {
        if (!(await messageElement.isVisible().catch(() => false))) {
            return;
        }

        await messageElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        
        await messageElement.dispatchEvent('mouseenter').catch(() => {});
        await messageElement.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500); 
        
        const deleteIcon = messageElement.locator('a.delete-chat').last();
        
        await deleteIcon.dispatchEvent('click').catch(async () => {
            await deleteIcon.evaluate(el => {
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                el.click();
            });
        });
        
        await this.chatDeleteConfirmButton.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
        await this.chatDeleteConfirmButton.dispatchEvent('click').catch(async () => await this.chatDeleteConfirmButton.click({ force: true }));
    }

    async deleteQuestion(questionElement) {
        await questionElement.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(() => {});
        
        await questionElement.evaluate(el => {
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }).catch(() => {});
        
        await questionElement.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500);

        const crossBtn = questionElement.locator('div.items-start > button').first();
        
        await crossBtn.evaluate(node => node.click()).catch(async () => await crossBtn.click({ force: true }));
        
        await this.questionDeleteButton.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
        await this.questionDeleteButton.evaluate(el => el.click()).catch(async () => await this.questionDeleteButton.click({ force: true }));
    }

    getQuestionByText(text) { return this.page.locator('div.mb-4.p-4').filter({ hasText: text }).first(); }
    getMessageByText(text) { return this.page.locator('.flex.message-box').filter({ hasText: text }).last(); }
    isInLiveRoom() { return this.page.url().includes('live-room'); }

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
        const answeredPolls = new Set();
        while (!this.page.isClosed() && this.isInLiveRoom()) {
            try {
                // FASTER RADAR: Check every 2 seconds instead of 5
                await this.page.waitForTimeout(2000); 

                if (await this.pollContainer.isVisible().catch(() => false)) {
                    const pollText = await this.pollContainer.innerText().catch(() => 'unknown');
                    
                    if (answeredPolls.has(pollText)) continue;

                    // SCOPED LOCATOR: Only find radio buttons INSIDE the specific poll popup
                    const scopedRadios = this.pollContainer.getByRole('radio');
                    const radios = await scopedRadios.all();

                    if (radios.length > 0) {
                        const randomRadio = radios[Math.floor(Math.random() * radios.length)];
                        
                        // Scroll to it and wait for any UI slide-in animations to finish
                        await randomRadio.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })).catch(()=>{});
                        await this.page.waitForTimeout(500); 

                        // Click the radio button
                        await randomRadio.evaluate(el => el.click()).catch(async () => await randomRadio.click({force: true}));
                        await this.page.waitForTimeout(1000);
                        
                        // Click Submit
                        await this.pollSubmitButton.evaluate(el => el.click()).catch(async () => await this.pollSubmitButton.click({force: true}));
                        
                        // Safely click back to the people tab to clear the screen
                        await this.peopleTab.evaluate(el => el.click()).catch(async () => await this.peopleTab.click({force: true}));
                        
                        answeredPolls.add(pollText);
                        console.log(`[${botName}] [POLL] ✓ Voted successfully.`);
                    }
                }
            } catch (e) { 
                if (e.message.includes('closed')) break; 
            }
        }
    }

    async _monitorOffers(botName) {
        const clickedOffers = new Set();
        while (!this.page.isClosed() && this.isInLiveRoom()) {
            try {
                await this.page.waitForTimeout(5000);
                if (await this.offerContainer.isVisible().catch(() => false)) {
                    const offerText = await this.offerContainer.innerText().catch(() => 'unknown');
                    if (clickedOffers.has(offerText)) continue;
                    const [newPage] = await Promise.all([
                        this.page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
                        this.offerActionElement.evaluate(el => el.click()).catch(async () => await this.offerActionElement.click({force: true}))
                    ]);
                    if (newPage) await newPage.close().catch(()=>{});
                    await this.peopleTab.evaluate(el => el.click()).catch(async () => await this.peopleTab.click({force: true}));
                    clickedOffers.add(offerText);
                    console.log(`[${botName}] [OFFER] ✓ Clicked.`);
                }
            } catch (e) { if (e.message.includes('closed')) break; }
        }
    }
}

module.exports = WebinarRoom;