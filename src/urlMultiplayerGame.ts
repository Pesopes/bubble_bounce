import { Vector, Bubble, Block, Button } from "./lib";
import { URLMultiplayer, SerializableGameState } from "./urlMultiplayer";

export class URLMultiplayerGame {
    // URL Multiplayer functions
    static prepareURLMultiplayerMenu(
        canvas: HTMLCanvasElement,
        buttons: Button[],
        previewBubbles: Bubble[],
        gameStateSetter: (state: any) => void,
        resetGameFn: () => void,
        startNewURLGameFn: () => void,
        loadFromPastedURLFn: (url: string) => void,
        loadURLGameFn?: (gameState: any) => void
    ) {
        // Clear previous buttons
        buttons.length = 0;
        previewBubbles.length = 0;

        const buttonDim = new Vector(600, 150);
        const spacing = 40;

        // Back button
        buttons.push(
            new Button(
                new Vector(50, 50),
                new Vector(150, 80),
                "← Back",
                (_but) => {
                    gameStateSetter(0); // MainMenu
                    resetGameFn();
                },
                "gray",
            ),
        );

        // Start new game button
        buttons.push(
            new Button(
                new Vector(
                    (canvas.width - buttonDim.x) / 2,
                    canvas.height / 2 - buttonDim.y * 2 - spacing * 2,
                ),
                buttonDim,
                "Start New Game",
                (_but) => {
                    startNewURLGameFn();
                },
                "lightgreen",
            ),
        );

        // Paste URL button
        buttons.push(
            new Button(
                new Vector(
                    (canvas.width - buttonDim.x) / 2,
                    canvas.height / 2 - buttonDim.y - spacing,
                ),
                buttonDim,
                "Paste Game URL",
                (_but) => {
                    const url = prompt("Paste the game URL here:");
                    if (url) {
                        loadFromPastedURLFn(url);
                    }
                },
                "orange",
            ),
        );

        // Discord Webhook button
        buttons.push(
            new Button(
                new Vector(
                    (canvas.width - buttonDim.x) / 2,
                    canvas.height / 2 + spacing,
                ),
                buttonDim,
                "Setup Discord Bot",
                (_but) => {
                    URLMultiplayerGame.setupDiscordWebhook();
                },
                "purple",
            ),
        );

        // Join existing game button (if there's a game in URL)
        const urlGameState = URLMultiplayer.loadFromURL();
        if (urlGameState && loadURLGameFn) {
            buttons.push(
                new Button(
                    new Vector(
                        (canvas.width - buttonDim.x) / 2,
                        canvas.height / 2 + spacing * 2.5,
                    ),
                    buttonDim,
                    `Join Game (Turn ${urlGameState.turnNumber})`,
                    (_but) => {
                        loadURLGameFn(urlGameState);
                    },
                    "lightblue",
                ),
            );
        }
    }

    static testURLMultiplayer(loadFromPastedURLFn: (url: string) => void) {
        console.log("Testing URLMultiplayer functions...");

        const testState = {
            gameId: "TEST123",
            turnNumber: 1,
            currentPlayer: 1,
            firstBounce: true,
            settings: {
                smallBallCount: 5,
                enableMiddleBlocks: true,
                requiredBounce: false,
                chosenSprites: [0, 1]
            },
            bubbles: [],
            blocks: []
        };

        console.log("Test state:", testState);

        try {
            const serialized = URLMultiplayer.serializeGameState([], [], 1, true, 1, testState.settings, "TEST123");
            console.log("Serialized:", serialized);

            const deserialized = URLMultiplayer.deserializeGameState(serialized);
            console.log("Deserialized:", deserialized);

            if (deserialized) {
                const isValid = URLMultiplayer.validateGameState(deserialized);
                console.log("Valid:", isValid);

                if (isValid) {
                    alert("URLMultiplayer test PASSED! The system works.");
                    // Create a test URL and load it
                    const testURL = `#game=${serialized}`;
                    loadFromPastedURLFn(testURL);
                } else {
                    alert("URLMultiplayer test FAILED: Validation failed");
                }
            } else {
                alert("URLMultiplayer test FAILED: Deserialization failed");
            }
        } catch (error) {
            console.error("URLMultiplayer test error:", error);
            alert(`URLMultiplayer test FAILED: ${error}`);
        }
    }

    static renderURLMultiplayerMenu(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        offscreenCanvas: OffscreenCanvas,
        buttons: Button[]
    ) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreenCanvas, 0, 0);

        for (const button of buttons) {
            button.render(ctx);
        }

        // Title
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.font = 'bold 80px "Helvetica", sans-serif';
        ctx.fillText("Share & Play", canvas.width / 2, canvas.height / 4);

        // Instructions
        ctx.font = '25px "Helvetica", sans-serif';
        ctx.fillText("Play with anyone by sharing URLs!", canvas.width / 2, canvas.height / 4 + 60);
        ctx.fillText("• Start a new game and share the URL", canvas.width / 2, canvas.height / 4 + 100);
        ctx.fillText("• Or join a game from a shared URL", canvas.width / 2, canvas.height / 4 + 130);

        // Show current URL game info if available
        const urlGameState = URLMultiplayer.loadFromURL();
        if (urlGameState) {
            const stats = URLMultiplayer.getGameStats(urlGameState);
            ctx.font = 'bold 30px "Helvetica", sans-serif';
            ctx.fillStyle = "darkgreen";
            ctx.fillText("📎 Game Found in URL!", canvas.width / 2, canvas.height - 200);

            ctx.font = '20px "Helvetica", sans-serif';
            ctx.fillStyle = "black";
            ctx.fillText(`Game ID: ${urlGameState.gameId} | Turn: ${urlGameState.turnNumber}`, canvas.width / 2, canvas.height - 170);
            ctx.fillText(`P1: ${stats.player1Bubbles} bubbles | P2: ${stats.player2Bubbles} bubbles`, canvas.width / 2, canvas.height - 150);
        }
    }

    // Setup Discord webhook integration
    static setupDiscordWebhook(): void {
        const currentWebhook = localStorage.getItem('bubble_bounce_discord_webhook') || '';

        const webhookUrl = prompt(
            `🤖 **Discord Bot Setup** 🤖\n\n` +
            `To automatically send game updates to Discord:\n\n` +
            `1. Go to your Discord server\n` +
            `2. Edit any channel → Integrations → Webhooks\n` +
            `3. Create New Webhook\n` +
            `4. Copy the webhook URL\n` +
            `5. Paste it below\n\n` +
            `Current webhook: ${currentWebhook ? 'CONFIGURED ✅' : 'Not set ❌'}\n\n` +
            `Enter Discord Webhook URL:`,
            currentWebhook
        );

        if (webhookUrl === null) return; // User cancelled

        if (webhookUrl === '') {
            // Remove webhook
            localStorage.removeItem('bubble_bounce_discord_webhook');
            localStorage.removeItem('bubble_bounce_discord_player_name');
            alert('✅ Discord webhook removed!');
            return;
        }

        if (!URLMultiplayer.validateDiscordWebhook(webhookUrl)) {
            alert('❌ Invalid Discord webhook URL!\n\nPlease make sure the URL contains "discord.com/api/webhooks/"');
            return;
        }

        // Save webhook
        localStorage.setItem('bubble_bounce_discord_webhook', webhookUrl);

        // Optionally set player name
        const playerName = prompt(
            '🎮 **Player Name** 🎮\n\n' +
            'What name should appear in Discord messages?\n' +
            '(Optional - leave empty for "Player 1/2")',
            localStorage.getItem('bubble_bounce_discord_player_name') || ''
        );

        if (playerName) {
            localStorage.setItem('bubble_bounce_discord_player_name', playerName);
        }

        alert(
            '✅ **Discord Bot Configured!** ✅\n\n' +
            '🚀 Game invitations will now be sent to Discord automatically!\n' +
            '🔄 Turn updates will notify players when it\'s their move!\n\n' +
            '💡 Tip: Both players can set up the same webhook to get notifications!'
        );
    }

    // Send game invitation to Discord (if webhook configured)
    static async sendGameInvitation(gameUrl: string, gameId: string, turnNumber: number): Promise<void> {
        const webhookUrl = localStorage.getItem('bubble_bounce_discord_webhook');
        const playerName = localStorage.getItem('bubble_bounce_discord_player_name');

        if (!webhookUrl) return;

        try {
            const success = await URLMultiplayer.sendToDiscordWebhook(
                webhookUrl,
                gameUrl,
                gameId,
                turnNumber,
                playerName || undefined
            );

            if (success) {
                console.log('✅ Game invitation sent to Discord!');
            } else {
                console.error('❌ Failed to send game invitation to Discord');
            }
        } catch (error) {
            console.error('❌ Discord webhook error:', error);
        }
    }

    // Send turn update to Discord (if webhook configured)
    static async sendTurnUpdate(
        gameUrl: string,
        gameId: string,
        turnNumber: number,
        currentPlayer: number,
        stats: { player1Bubbles: number; player2Bubbles: number }
    ): Promise<void> {
        const webhookUrl = localStorage.getItem('bubble_bounce_discord_webhook');
        const playerName = localStorage.getItem('bubble_bounce_discord_player_name');

        if (!webhookUrl) return;

        try {
            const success = await URLMultiplayer.sendGameUpdateToDiscord(
                webhookUrl,
                gameUrl,
                gameId,
                turnNumber,
                currentPlayer,
                stats,
                playerName || undefined
            );

            if (success) {
                console.log('✅ Turn update sent to Discord!');
            } else {
                console.error('❌ Failed to send turn update to Discord');
            }
        } catch (error) {
            console.error('❌ Discord webhook error:', error);
        }
    }
}