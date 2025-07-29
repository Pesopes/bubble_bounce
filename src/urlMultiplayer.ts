import { Vector, Bubble, Block } from "./lib";

export interface SerializableGameState {
    // Game metadata
    gameId: string;
    turnNumber: number;
    currentPlayer: number;
    firstBounce: boolean;

    // Game settings
    settings: {
        smallBallCount: number;
        enableMiddleBlocks: boolean;
        requiredBounce: boolean;
        chosenSprites: number[];
    };

    // Game objects (simplified for serialization)
    bubbles: Array<{
        x: number;
        y: number;
        radius: number;
        spriteIndex: number;
        player: number;
        rot: number;
    }>;

    blocks: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        borderRadius: number;
    }>;
}

export class URLMultiplayer {
    private static readonly URL_PREFIX = '#game=';

    // Generate a short game ID
    private static generateGameId(): string {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Serialize game state to a compact format
    static serializeGameState(
        bubbles: Bubble[],
        blocks: Block[],
        currentPlayer: number,
        firstBounce: boolean,
        turnNumber: number,
        settings: {
            smallBallCount: number;
            enableMiddleBlocks: boolean;
            requiredBounce: boolean;
            chosenSprites: number[];
        },
        gameId?: string
    ): string {
        console.log("URLMultiplayer: Starting ultra-compact serialization");

        // Ultra-compact binary-like format (no JSON overhead)
        let compact = '';

        // Header: gameId (6 chars), turnNumber (1-2 digits), currentPlayer (1), firstBounce (1)
        const id = (gameId || this.generateGameId()).substring(0, 6);
        compact += id;
        compact += turnNumber.toString(36); // Base36 for shorter numbers
        compact += currentPlayer;
        compact += firstBounce ? '1' : '0';

        // Settings: smallBallCount, enableMiddleBlocks, requiredBounce, chosenSprites
        compact += settings.smallBallCount.toString(36);
        compact += settings.enableMiddleBlocks ? '1' : '0';
        compact += settings.requiredBounce ? '1' : '0';
        compact += settings.chosenSprites.join('');
        compact += '|'; // Separator

        // Bubbles: ultra-compact format
        compact += bubbles.length.toString(36);
        for (const b of bubbles) {
            // Pack position (0-950 canvas) into base36
            compact += Math.round(b.pos.x).toString(36);
            compact += ',';
            compact += Math.round(b.pos.y).toString(36);
            compact += ',';
            compact += b.radius.toString(36);
            compact += ',';
            compact += b.spriteIndex.toString(36);
            compact += ',';
            compact += b.player;
            compact += ',';
            compact += Math.round(b.rot * 10).toString(36); // Keep 1 decimal
            compact += ';';
        }
        compact += '|'; // Separator

        // Blocks: ultra-compact format
        compact += blocks.length.toString(36);
        for (const b of blocks) {
            compact += Math.round(b.pos.x).toString(36);
            compact += ',';
            compact += Math.round(b.pos.y).toString(36);
            compact += ',';
            compact += Math.round(b.dim.x).toString(36);
            compact += ',';
            compact += Math.round(b.dim.y).toString(36);
            compact += ',';
            compact += Math.round(b.borderRadius).toString(36);
            compact += ';';
        }

        console.log("URLMultiplayer: Compact format length:", compact.length);

        // Ultra compression
        const compressed = this.ultraCompress(compact);
        console.log("URLMultiplayer: Final compressed length:", compressed.length);

        return compressed;
    }

    // Deserialize game state from URL format
    static deserializeGameState(encodedState: string): SerializableGameState | null {
        try {
            console.log("URLMultiplayer: Starting deserialization of:", encodedState.substring(0, 50) + "...");

            // Decode the ultra-compressed format
            const decompressed = this.ultraDecompress(encodedState);
            console.log("URLMultiplayer: Decompressed to:", decompressed);

            // Parse the compact format
            const parts = decompressed.split('|');
            if (parts.length !== 3) throw new Error('Invalid format');

            // Parse header
            const header = parts[0];
            const gameId = header.substring(0, 6);
            let pos = 6;
            const turnNumber = parseInt(header[pos], 36);
            pos++;
            const currentPlayer = parseInt(header[pos]);
            pos++;
            const firstBounce = header[pos] === '1';
            pos++;
            const smallBallCount = parseInt(header[pos], 36);
            pos++;
            const enableMiddleBlocks = header[pos] === '1';
            pos++;
            const requiredBounce = header[pos] === '1';
            pos++;
            const chosenSprites = [parseInt(header[pos]), parseInt(header[pos + 1])];

            // Parse bubbles
            const bubblesData = parts[1];
            const bubbles: any[] = [];
            if (bubblesData) {
                const bubbleEntries = bubblesData.substring(1).split(';').filter((e: string) => e);

                for (const entry of bubbleEntries) {
                    const values = entry.split(',');
                    if (values.length >= 6) {
                        bubbles.push({
                            x: parseInt(values[0], 36),
                            y: parseInt(values[1], 36),
                            radius: parseInt(values[2], 36),
                            spriteIndex: parseInt(values[3], 36),
                            player: parseInt(values[4]),
                            rot: parseInt(values[5], 36) / 10
                        });
                    }
                }
            }

            // Parse blocks
            const blocksData = parts[2];
            const blocks: any[] = [];
            if (blocksData) {
                const blockEntries = blocksData.substring(1).split(';').filter((e: string) => e);

                for (const entry of blockEntries) {
                    const values = entry.split(',');
                    if (values.length >= 5) {
                        blocks.push({
                            x: parseInt(values[0], 36),
                            y: parseInt(values[1], 36),
                            width: parseInt(values[2], 36),
                            height: parseInt(values[3], 36),
                            borderRadius: parseInt(values[4], 36)
                        });
                    }
                }
            }

            const result: SerializableGameState = {
                gameId,
                turnNumber,
                currentPlayer,
                firstBounce,
                settings: {
                    smallBallCount,
                    enableMiddleBlocks,
                    requiredBounce,
                    chosenSprites
                },
                bubbles,
                blocks
            };

            console.log("URLMultiplayer: Parsed result:", result);
            return result;
        } catch (error) {
            console.error('URLMultiplayer: Failed to deserialize game state:', error);
            console.error('URLMultiplayer: Input was:', encodedState);
            return null;
        }
    }

    // Convert serializable state back to game objects
    static restoreGameObjects(state: SerializableGameState): {
        bubbles: Bubble[];
        blocks: Block[];
    } {
        const bubbles = state.bubbles.map(b => {
            const bubble = new Bubble(
                new Vector(b.x, b.y),
                b.radius,
                new Vector(0, 0), // Zero velocity since game state is saved when stationary
                b.spriteIndex,
                b.player
            );
            bubble.rot = b.rot;
            bubble.rotSpeed = 0; // Zero rotation speed
            bubble.bouncedOffWall = false; // Reset bounce state
            return bubble;
        });

        const blocks = state.blocks.map(b =>
            new Block(
                new Vector(b.x, b.y),
                new Vector(b.width, b.height),
                b.borderRadius
            )
        );

        return { bubbles, blocks };
    }

    // Generate a shareable URL for the current game state
    static generateShareURL(
        bubbles: Bubble[],
        blocks: Block[],
        currentPlayer: number,
        firstBounce: boolean,
        turnNumber: number,
        settings: {
            smallBallCount: number;
            enableMiddleBlocks: boolean;
            requiredBounce: boolean;
            chosenSprites: number[];
        },
        gameId?: string
    ): string {
        const encoded = this.serializeGameState(
            bubbles, blocks, currentPlayer, firstBounce, turnNumber, settings, gameId
        );

        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}${this.URL_PREFIX}${encoded}`;
    }

    // Load game state from current URL
    static loadFromURL(): SerializableGameState | null {
        const hash = window.location.hash;
        if (!hash.startsWith(this.URL_PREFIX)) {
            return null;
        }

        const encoded = hash.substring(this.URL_PREFIX.length);
        return this.deserializeGameState(encoded);
    }

    // Update current URL with new game state
    static updateURL(url: string): void {
        const urlObj = new URL(url);
        window.history.replaceState(null, '', urlObj.hash);
    }

    // Copy URL to clipboard
    static async copyToClipboard(url: string): Promise<boolean> {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }

    // Generate QR code data URL for sharing
    static generateQRCode(url: string): string {
        // This is a simple QR code implementation
        // In production, you might want to use a proper QR code library
        const qrData = encodeURIComponent(url);
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
    }

    // Send game URL to Discord via webhook
    static async sendToDiscordWebhook(
        webhookUrl: string,
        gameUrl: string,
        gameId: string,
        turnNumber: number,
        playerName?: string
    ): Promise<boolean> {
        try {
            const playerText = playerName ? `${playerName}'s` : "Someone's";
            const embed = {
                title: "🎮 Bubble Bounce Game Invitation!",
                description: `${playerText} game is ready to play!`,
                color: 0x00ff00, // Green color
                fields: [
                    {
                        name: "🆔 Game ID",
                        value: gameId,
                        inline: true
                    },
                    {
                        name: "🔄 Turn",
                        value: turnNumber.toString(),
                        inline: true
                    },
                    {
                        name: "🎯 How to Join",
                        value: "Click the link below to join the game!",
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Bubble Bounce Multiplayer"
                }
            };

            const payload = {
                content: `🎲 **New Bubble Bounce Game!** 🎲\n\n${gameUrl}`,
                embeds: [embed]
            };

            console.log("Sending to Discord webhook:", webhookUrl, payload);

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log("Successfully sent to Discord!");
                return true;
            } else {
                console.error("Discord webhook failed:", response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error("Error sending to Discord webhook:", error);
            return false;
        }
    }

    // Send game update to Discord (when turn is completed)
    static async sendGameUpdateToDiscord(
        webhookUrl: string,
        gameUrl: string,
        gameId: string,
        turnNumber: number,
        currentPlayer: number,
        stats: { player1Bubbles: number; player2Bubbles: number },
        playerName?: string
    ): Promise<boolean> {
        try {
            const playerText = playerName ? playerName : `Player ${currentPlayer === 1 ? 2 : 1}`;
            const nextPlayer = currentPlayer;

            const embed = {
                title: "🔄 Game Update - Your Turn!",
                description: `${playerText} completed their turn. It's now Player ${nextPlayer}'s turn!`,
                color: currentPlayer === 1 ? 0xff0000 : 0x0000ff, // Red for P1, Blue for P2
                fields: [
                    {
                        name: "🆔 Game ID",
                        value: gameId,
                        inline: true
                    },
                    {
                        name: "🔄 Turn #",
                        value: turnNumber.toString(),
                        inline: true
                    },
                    {
                        name: "📊 Current Score",
                        value: `P1: ${stats.player1Bubbles} bubbles\nP2: ${stats.player2Bubbles} bubbles`,
                        inline: false
                    },
                    {
                        name: `🎯 Player ${nextPlayer} - Make Your Move!`,
                        value: "Click the link below to continue the game!",
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Bubble Bounce Multiplayer"
                }
            };

            const payload = {
                content: `🎮 **Turn ${turnNumber} Complete!** 🎮\n\n${gameUrl}`,
                embeds: [embed]
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            return response.ok;
        } catch (error) {
            console.error("Error sending game update to Discord:", error);
            return false;
        }
    }

    // Simple webhook URL validation
    static validateDiscordWebhook(url: string): boolean {
        return url.includes('discord.com/api/webhooks/') || url.includes('discordapp.com/api/webhooks/');
    }

    // Create sharing links for various platforms
    static generateSharingLinks(url: string, gameId: string): {
        whatsapp: string;
        telegram: string;
        discord: string;
        email: string;
    } {
        const message = `Join my Bubble Bounce game! Game ID: ${gameId}`;
        const encodedMessage = encodeURIComponent(message);
        const encodedUrl = encodeURIComponent(url);

        return {
            whatsapp: `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`,
            telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`,
            discord: url, // Discord doesn't have a direct share URL, just copy the link
            email: `mailto:?subject=Bubble Bounce Game&body=${encodedMessage}%20${encodedUrl}`
        };
    }

    // Ultra compression using LZ77-like algorithm and base62
    private static ultraCompress(str: string): string {
        // LZ77-style compression
        let compressed = '';
        let i = 0;

        while (i < str.length) {
            let maxLen = 0;
            let maxOffset = 0;

            // Look for matches in previous 255 characters
            for (let offset = 1; offset <= Math.min(i, 255); offset++) {
                let len = 0;
                while (len < 255 && i + len < str.length &&
                    str[i + len] === str[i - offset + len]) {
                    len++;
                }
                if (len > maxLen && len > 2) {
                    maxLen = len;
                    maxOffset = offset;
                }
            }

            if (maxLen > 2) {
                // Encode as reference: offset + length
                compressed += String.fromCharCode(255, maxOffset, maxLen);
                i += maxLen;
            } else {
                compressed += str[i];
                i++;
            }
        }

        // Base62 encode
        return this.base62Encode(compressed);
    }

    // Ultra decompression
    private static ultraDecompress(str: string): string {
        // Base62 decode
        const decoded = this.base62Decode(str);

        // LZ77-style decompression
        let result = '';
        let i = 0;

        while (i < decoded.length) {
            if (decoded.charCodeAt(i) === 255) {
                // Reference found
                const offset = decoded.charCodeAt(i + 1);
                const length = decoded.charCodeAt(i + 2);

                for (let j = 0; j < length; j++) {
                    result += result[result.length - offset];
                }
                i += 3;
            } else {
                result += decoded[i];
                i++;
            }
        }

        return result;
    }

    // Base62 encoding for maximum compression
    private static base62Encode(str: string): string {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let result = '';

        // Convert string to big number and encode in base62
        for (let i = 0; i < str.length; i += 2) {
            let num = str.charCodeAt(i);
            if (i + 1 < str.length) {
                num = num * 256 + str.charCodeAt(i + 1);
            }

            // Convert to base62
            let encoded = '';
            if (num === 0) {
                encoded = '0';
            } else {
                while (num > 0) {
                    encoded = chars[num % 62] + encoded;
                    num = Math.floor(num / 62);
                }
            }
            result += encoded + '_';
        }

        return result.slice(0, -1); // Remove last underscore
    }

    // Base62 decoding
    private static base62Decode(str: string): string {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const parts = str.split('_');
        let result = '';

        for (const part of parts) {
            let num = 0;
            for (const char of part) {
                const index = chars.indexOf(char);
                if (index !== -1) {
                    num = num * 62 + index;
                }
            }

            // Convert back to 1-2 characters
            if (num >= 256) {
                result += String.fromCharCode(Math.floor(num / 256), num % 256);
            } else {
                result += String.fromCharCode(num);
            }
        }

        return result;
    }

    // Validate game state integrity
    static validateGameState(state: SerializableGameState): boolean {
        try {
            // Basic validation
            if (!state.gameId || !Array.isArray(state.bubbles) || !Array.isArray(state.blocks)) {
                return false;
            }

            if (state.currentPlayer < 1 || state.currentPlayer > 2) {
                return false;
            }

            if (state.turnNumber < 0) {
                return false;
            }

            // Validate bubbles
            for (const bubble of state.bubbles) {
                if (typeof bubble.x !== 'number' || typeof bubble.y !== 'number') {
                    return false;
                }
                if (bubble.player < 1 || bubble.player > 2) {
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    // Get game statistics for display
    static getGameStats(state: SerializableGameState): {
        player1Bubbles: number;
        player2Bubbles: number;
        totalBubbles: number;
        gameProgress: string;
    } {
        const player1Bubbles = state.bubbles.filter(b => b.player === 1).length;
        const player2Bubbles = state.bubbles.filter(b => b.player === 2).length;
        const totalBubbles = state.bubbles.length;

        let gameProgress = 'Early game';
        if (state.turnNumber > 10) gameProgress = 'Mid game';
        if (state.turnNumber > 20) gameProgress = 'Late game';
        if (totalBubbles < 10) gameProgress = 'Final stage';

        return {
            player1Bubbles,
            player2Bubbles,
            totalBubbles,
            gameProgress
        };
    }
}