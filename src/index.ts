import { Vector, Bubble, Block, Button, drawCircle } from "./lib";
import backgroundImageSrc from "./assets/abstract_dots.svg";
import { GameInputCallbacks, InputManager } from "./input";
import { LocalStorageManager } from "./localStorage";

const ballSpriteModules = import.meta.glob("./assets/balls/*.png", {
	eager: true,
	query: "?url",
	import: "default",
});
// Loads all ball sprites from the assets/balls directory
const ballSprites = Object.fromEntries(
	Object.entries(ballSpriteModules).map(([path, url]) => {
		const match = path.match(/(\d+)\.png$/);
		const ballNumber = match ? match[1] : "1";
		const img = new Image();
		img.src = url as string;

		return [ballNumber, img];
	}),
);


type SaveState = {
	bubbles: Bubble[];
	blocks: Block[];
	currentPlayer: number;
	firstBounce: boolean;
	// chosenSprites: number[];
	// smallBallCount: number;
	// enableMiddleBlocks: boolean;
	// requiredBounce: boolean;
}

const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
if (!canvas) {
	throw new Error("Canvas not found");
}
const ctx = canvas.getContext("2d");
if (!ctx) {
	throw new Error("2D context not found");
}

// Used for background and static objects (meant to improve performance)
const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);

const offCtx = offscreenCanvas.getContext("2d", { alpha: false }) as OffscreenCanvasRenderingContext2D;
if (!offCtx) {
	throw new Error("2D context not found for offscreen canvas");
}

let mousePos = new Vector();


// Spawned objects
let bubbles: Bubble[] = [];
let blocks: Block[] = [];
let buttons: Button[] = [];
let previewBubbles: Bubble[] = [];

enum GameState {
	MainMenu,
	Game,
	EndScreen
}

// game state
let frame = 0;
let gameState = GameState.MainMenu;
let winningPlayer = 0;
let currentPlayer = Math.round(Math.random()) + 1;
let isWaiting = false;
let saveStateBeforeShot: SaveState | null = null;
let firstBounce = true;

// Gameplay settings
let enableMiddleBlocks = true;
let requiredBounce = false;
const presetBallCounts = [0, 3, 5, 8, 10, 15];
let smallBallCount = presetBallCounts[2];

const bigBallSize = 75;
const mediumBallSize = 50;
const smallBallSize = 37;
const distanceFromSide = 300; //determines how far it will spawn the balls based on the top/bottom border
const maxVelocityLen = 500;
const slowSpeedThreshold = 0.6; // threshold for slow speed, game speeds up when all bubbles are below this speed
const stopSpeedThreshold = 0.03; // threshold for stopping the turn, when all bubbles are below this speed
// Visual settings
let chosenSprites: number[] = [];
let renderLinesBetween = true;
let chargeDir = -1;

let inputManager: InputManager;

const fireForce = 18;

const backgroundImage = new Image();


backgroundImage.src = backgroundImageSrc;
// The bubble that is being dragged (to be shot)
let clickedBub: Bubble | null = null;



const isColliding = (testBub: Bubble) => {
	for (const block of blocks) {
		if (testBub.isCollidingBlock(block)) {
			return true;
		}
	}
	for (const bubble of bubbles) {
		if (testBub.isCollidingBubble(bubble)) {
			return true;
		}
	}
	return false;
};
function getBallSprite(index: number) {
	return Object.values(ballSprites)[index] || ballSprites["1"];
}
// Returns the sprite image based on the image name 
// function getBallSpriteByName(num: number) {
// 	return ballSprites[num.toString()] || ballSprites["1"];
// }

function getRandomBallSpriteIdx() {
	return Math.floor(Math.random() * Object.keys(ballSprites).length);
}

function randomizeChosenSprites() {
	// Get random starting sprites that are different to each other
	chosenSprites[0] = getRandomBallSpriteIdx();
	do {
		chosenSprites[1] = getRandomBallSpriteIdx();
	} while (chosenSprites[0] === chosenSprites[1]);

}

// Create the main menu elements
function prepareStart() {
	const buttonDim = new Vector(600, 200);
	const spacing = 40;
	const onColor = "#92D8F8";
	const offColor = "#363858";
	// going from bottom to top
	// START button
	const startButtonDim = new Vector(700, 250);
	buttons.push(
		new Button(
			new Vector(
				(canvas.width - startButtonDim.x) / 2,
				canvas.height - startButtonDim.y - 100,
			),
			startButtonDim,
			"START",
			(_but) => {
				resetGame();
				gameState = GameState.Game;
			},
			"pink",
		),
	);
	//MIDDLE BLOCK TOGGLE
	buttons.push(
		new Button(
			new Vector(
				(canvas.width - buttonDim.x) / 2,
				canvas.height - buttonDim.y * 1 - 400,
			),
			buttonDim,
			enableMiddleBlocks ? "Blocks: Enabled" : "Blocks: Disabled",
			(but) => {
				enableMiddleBlocks = !enableMiddleBlocks;
				but.text = enableMiddleBlocks ? "Blocks: Enabled" : "Blocks: Disabled";
				but.color = enableMiddleBlocks ? onColor : offColor;

				saveSettings();
			},

			enableMiddleBlocks ? onColor : offColor,
		),
	);
	// BOUNCE TOGGLE
	buttons.push(
		new Button(
			new Vector(
				(canvas.width - buttonDim.x) / 2,
				canvas.height - buttonDim.y * 2 - 400 - spacing * 1,
			),
			buttonDim,
			requiredBounce ? "Require bounce: Enabled" : "Require bounce: Disabled",
			(but) => {
				requiredBounce = !requiredBounce;
				but.text = requiredBounce
					? "Require bounce: Enabled"
					: "Require bounce: Disabled";
				but.color = requiredBounce ? onColor : offColor;
				saveSettings();

			},

			requiredBounce ? onColor : offColor,
		),
	);
	// CHANGE BALL COUNT BUTTONS
	const startingBallCountRatio =
		smallBallCount / presetBallCounts[presetBallCounts.length - 1];
	const ballCountColor = `rgb(${-startingBallCountRatio * 100 + 200
		}, ${233}, ${203})`;
	buttons.push(
		new Button(
			new Vector(
				(canvas.width - buttonDim.x) / 2,
				canvas.height - buttonDim.y * 3 - 400 - spacing * 2,
			),
			buttonDim,
			`Small bubbles: ${smallBallCount}`,
			(but) => {
				const currentIndex = presetBallCounts.indexOf(smallBallCount);
				smallBallCount =
					presetBallCounts[(currentIndex + 1) % presetBallCounts.length];
				const ballCountRatio =
					smallBallCount / presetBallCounts[presetBallCounts.length - 1];
				but.color = `rgb(${-ballCountRatio * 100 + 200}, ${233}, ${203})`;
				but.text = `Small bubbles: ${smallBallCount}`;
				saveSettings();

			},

			ballCountColor,
		),
	);
	//
	// PREVIEW BALLS AND BUTTONS
	// There are two balls each with two buttons to cycle all availableSprites and choose

	const previewPosCenter = new Vector(canvas.width / 2, 300);

	// Randomize sprites button
	const randomizeButtonDim = new Vector(200, 110);
	buttons.push(
		new Button(
			new Vector(
				(canvas.width - randomizeButtonDim.x) / 2,
				previewPosCenter.y + bigBallSize / 2 + randomizeButtonDim.y - spacing - 20,
			),
			randomizeButtonDim,
			`Randomize`,
			(_but) => {
				randomizeChosenSprites();
				for (let i = 0; i < previewBubbles.length; i++) {
					previewBubbles[i].spriteIndex = chosenSprites[i];
				}
				saveSettings();
			},

			ballCountColor,
		),
	);


	const previewButtonSwitchDim = new Vector(80, bigBallSize * 2);
	const previewButtonColor = "#dbedd0";
	const previewBubbleOffset = 200;

	if (chosenSprites.length === 0) {
		randomizeChosenSprites();
	}

	// Do for both players
	for (let i = 0; i <= 1; i++) {
		const sign = i * 2 - 1; // changes based on player: p1=>-1, p2=>1
		previewBubbles.push(
			new Bubble(
				previewPosCenter.add(new Vector(sign * previewBubbleOffset, 0)),
				bigBallSize,
				new Vector(),
				chosenSprites[i],
				i + 1,
			),
		);
		buttons.push(
			new Button(
				previewPosCenter.add(
					new Vector(
						sign * previewBubbleOffset - bigBallSize - previewButtonSwitchDim.x,
						-previewButtonSwitchDim.y / 2,
					),
				),
				previewButtonSwitchDim,
				"<",
				(_but) => {
					chosenSprites[i] = (chosenSprites[i] - 1) % Object.keys(ballSprites).length;
					if (chosenSprites[i] < 0)
						chosenSprites[i] = Object.keys(ballSprites).length - 1;
					previewBubbles[i].spriteIndex = chosenSprites[i];
					saveSettings();

				},

				previewButtonColor,
				20,
			),
		);
		buttons.push(
			new Button(
				previewPosCenter.add(
					new Vector(
						sign * previewBubbleOffset + bigBallSize,
						-previewButtonSwitchDim.y / 2,
					),
				),
				previewButtonSwitchDim,
				">",
				(_but) => {
					chosenSprites[i] = (chosenSprites[i] + 1) % Object.keys(ballSprites).length;
					previewBubbles[i].spriteIndex = chosenSprites[i];
					saveSettings();

				},

				previewButtonColor,
				20,
			),
		);
	}
}

// Create static playing blocks at random positions
function prepareBoard() {
	const sideBlockDim = new Vector(30, 700);
	const sideBlockOffset = sideBlockDim.x / 5;
	const rightBlockPos = new Vector(
		canvas.width - sideBlockOffset - sideBlockDim.x,
		(canvas.height - sideBlockDim.y) / 2,
	);
	blocks.push(
		new Block(
			new Vector(sideBlockOffset, (canvas.height - sideBlockDim.y) / 2),
			sideBlockDim.mult(1),
		),
	);
	blocks.push(new Block(rightBlockPos, sideBlockDim.mult(1)));

	if (enableMiddleBlocks) {
		// Spawn mid blocks
		const blockCount = Math.round(Math.random()) + 1;
		if (blockCount === 1) {
			const size = 230 + 170 * Math.random();
			const midBlockPos = new Vector(
				sideBlockOffset +
				sideBlockDim.x +
				Math.random() *
				(canvas.width - size - 2 * (sideBlockOffset + sideBlockDim.x)),
				(canvas.height - sideBlockDim.x) / 2,
			);
			blocks.push(new Block(midBlockPos, new Vector(size, sideBlockDim.x)));
		} else if (blockCount === 2) {
			const size1 = 170 + 80 * Math.random();
			const size2 = 100 + 50 * Math.random();
			const firstMidBlockPos = new Vector(
				sideBlockOffset +
				sideBlockDim.x +
				Math.random() *
				(canvas.width -
					size1 -
					size2 -
					2 * (sideBlockOffset + sideBlockDim.x)),
				(canvas.height - sideBlockDim.x) / 2,
			);
			const secondMidBlockPos = new Vector(
				firstMidBlockPos.x +
				size1 +
				Math.random() *
				(canvas.width -
					size1 -
					size2 -
					firstMidBlockPos.x -
					sideBlockOffset -
					sideBlockDim.x),
				(canvas.height - sideBlockDim.x) / 2,
			);
			blocks.push(
				new Block(firstMidBlockPos, new Vector(size1, sideBlockDim.x)),
			);
			blocks.push(
				new Block(secondMidBlockPos, new Vector(size2, sideBlockDim.x)),
			);
		}
	}
}

// Since it is made only once do it after the image is loaded
backgroundImage.onload = (_e) => {
	prepareOffscreenCanvas();
};
// The offscreen canvas is rendered once to increase performance
function prepareOffscreenCanvas() {
	// set same dimensions
	offscreenCanvas.width = canvas.width;
	offscreenCanvas.height = canvas.height;
	// Clear with colour
	offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
	offCtx.fillStyle = "#efe1e1";
	offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
	// Add background image
	offCtx.save();
	offCtx.filter = "drop-shadow(4px 4px 5px black) brightness(0.1) opacity(10%)";
	offCtx.scale(2, 2);
	offCtx.drawImage(
		backgroundImage,
		0,
		0,
		backgroundImage.width,
		backgroundImage.height,
	);
	offCtx.restore();
	// Line in middle
	if (enableMiddleBlocks && gameState !== GameState.EndScreen) {
		offCtx.lineWidth = 3;
		offCtx.strokeStyle = "rgba(0, 0, 0, 0.4)";
		offCtx.beginPath();
		offCtx.moveTo(offscreenCanvas.width / 10, offscreenCanvas.height / 2);
		offCtx.lineTo((9 * offscreenCanvas.width) / 10, offscreenCanvas.height / 2);
		offCtx.stroke();
	}
	// Render static blocks
	for (const block of blocks) {
		block.render(offCtx);
	}
}
// Spawn the playing balls, some in preset positions and sizes, others randomly
function spawnPlayerBalls(center: Vector, playerSpriteIndex: number, playerNum: number, top: boolean) {
	// Converts bool to int (-1 or 1)
	const side = +top * 2 - 1;
	const newBub = new Bubble(
		center,
		bigBallSize,
		new Vector(),
		playerSpriteIndex,
		playerNum,
	);
	bubbles.push(newBub);
	// Medium balls in front of big one
	for (let i = 0; i <= 5; i++) {
		bubbles.push(
			new Bubble(
				new Vector(
					(i / 5) * canvas.width,
					center.y + (distanceFromSide / 2) * side,
				),
				mediumBallSize,
				new Vector(),
				playerSpriteIndex,
				playerNum,
			),
		);
	}
	// Random small ones
	const iterMax = 150;
	let iterCount = 0;
	let iterAll = 0;
	while (iterCount < smallBallCount && iterAll <= iterMax) {
		const newSmallBub = new Bubble(
			new Vector(
				smallBallSize + Math.random() * (canvas.width - smallBallSize * 2),
				center.y - (distanceFromSide / 2) * side * Math.random(),
			),
			smallBallSize,
			new Vector(),
			playerSpriteIndex,
			playerNum,
		);
		if (!isColliding(newSmallBub)) {
			iterCount++;
			bubbles.push(newSmallBub);
		}
		iterAll++;
	}
	if (iterAll >= iterMax) {
		console.error("couldn't spawn all small bubbles :(");
	}
}
// This is called first
function init() {
	// DO THIS FIRST ALWAYS (the game is made for a constant width and height)
	resizeCanvas();

	loadSettings(getSettings());

	prepareBoard();

	prepareStart();
	const topPlayerCenter = new Vector(canvas.width / 2, distanceFromSide);
	const bottomPlayerCenter = new Vector(
		canvas.width / 2,
		canvas.height - distanceFromSide,
	);
	spawnPlayerBalls(topPlayerCenter, chosenSprites[0], 1, true);
	spawnPlayerBalls(bottomPlayerCenter, chosenSprites[1], 2, false);
}

function setupInput() {
	const gameCallbacks: GameInputCallbacks = {
		onPointerMove: (pos) => {
			mousePos = pos;
		},
		onPointerDown: (pos) => {
			mousePos = pos;
			if (gameState === GameState.MainMenu) {
				for (const button of buttons) {
					button.checkClick(pos);
				}
				return;
			}
			if (gameState === GameState.EndScreen) {
				resetGame();
				return;
			}
			// start aiming (saves the clicked bubble)
			if (gameState === GameState.Game && !isWaiting) {
				clickedBub = get_bubble_in_pos(mousePos);
				if (clickedBub && clickedBub.player !== currentPlayer) {
					clickedBub = null;
				}
			}
		},
		onPointerUp(_pos) {
			// Stopped aiming -> shoot
			if (clickedBub) {
				const dirVec = clickedBub.pos.sub(mousePos).mult(chargeDir);

				// Aimed very near the clicked bubble so cancel the shot
				if (dirVec.length() - clickedBub.radius <= 20) {
					clickedBub = null;
					return;
				}
				// Make a save state before shooting
				firstBounce = true;
				saveStateBeforeShot = getSaveState();
				// Shoot the bubble
				clickedBub.velocity = dirVec
					.normalize()
					.mult(
						(Math.min(dirVec.length(), maxVelocityLen) / maxVelocityLen) *
						fireForce,
					);
				clickedBub = null;
				switchPlayer();
				isWaiting = true;
			}
		},
		onScroll(deltaY) {
			if (deltaY < 0) {
				zoomIn();
			} else {
				zoomOut();
			}
		},
		onPinch: (direction) => {
			if (direction === "in") {
				zoomIn();
			} else if (direction === "out") {
				zoomOut();
			}
		},
		onResize: () => {
			resizeCanvas();
		},
	};

	inputManager = new InputManager(canvas, gameCallbacks);
	inputManager.onKey("Escape", () => {
		if (gameState === GameState.Game || gameState === GameState.EndScreen) {
			resetGame();
		}
	});
}
function resetGame() {
	gameState = GameState.MainMenu;
	bubbles = [];
	blocks = [];
	buttons = [];
	previewBubbles = [];

	currentPlayer = Math.round(Math.random()) + 1;
	init();
	prepareOffscreenCanvas();
}



function getSaveState(): SaveState {
	return {
		bubbles: bubbles.map((b) => b.clone()),
		blocks: blocks.map((b) => b.clone()),
		currentPlayer,
		firstBounce,
		// chosenSprites: [...chosenSprites],
		// smallBallCount,
		// enableMiddleBlocks,
		// requiredBounce,
	};
}
function loadSaveState(saveState: SaveState) {
	// Maybe I should clone here as well?
	bubbles = saveState.bubbles;
	blocks = saveState.blocks;
	currentPlayer = saveState.currentPlayer;
	firstBounce = saveState.firstBounce;
	// chosenSprites = [...saveState.chosenSprites];
	// smallBallCount = saveState.smallBallCount;
	// enableMiddleBlocks = saveState.enableMiddleBlocks;
	// requiredBounce = saveState.requiredBounce;

	// prepareOffscreenCanvas();
}

// Called when resizing but currently static
function resizeCanvas() {
	canvas.height = 1600;
	canvas.width = 950;
}
function winGame(player: 0 | 1 | 2) {
	gameState = GameState.EndScreen;
	blocks = [];
	prepareOffscreenCanvas();
	winningPlayer = player;
}
function switchPlayer() {
	if (currentPlayer === 1) {
		currentPlayer = 2;
	} else {
		currentPlayer = 1;
	}
}


const fastestBubbleVelocity = () => {
	let maxVel = 0;
	for (const bubble of bubbles) {
		if (bubble.velocity.length() > maxVel) {
			maxVel = bubble.velocity.length();
		}
	}
	return maxVel;
}

// TODO: make with an enum
// Checks for remaining bubbles and returns the winner (0 for draw, 1 for player 1, 2 for player 2)
const getWinner = (): 0 | 1 | 2 => {
	let anyPlayer1 = false;
	let anyPlayer2 = false;
	for (const bubble of bubbles) {
		if (bubble.player === 1) {
			anyPlayer1 = true;
		} else {
			anyPlayer2 = true;
		}
		if (anyPlayer1 && anyPlayer2) {
			break;
		}
	}
	if (anyPlayer1 && anyPlayer2) {
		return 0; // draw
	}
	return anyPlayer1 ? 2 : 1; // if player 1 has bubbles p2 wins and vice versa

};
function updateAllBubbles() {
	bubbles.forEach((b1, i) => {
		b1.update();
		for (const b2 of bubbles.slice(i + 1)) {
			const result = b1.collideBubble(b2);
			if (result) {
				if (firstBounce && requiredBounce) {
					// If different players' balls collide
					if ((b1.player === currentPlayer) !== (b2.player === currentPlayer)) {
						loadSaveState(saveStateBeforeShot ?? getSaveState())
					}
				}
				firstBounce = false;
			}
		}
		for (const block of blocks) {
			const result = b1.collideBlock(block);
			if (result) {
				firstBounce = false;
			}
		}
	});
}
// Generic update func, handles collision
function update(tFrame: number) {
	frame = tFrame;
	// Delete bubbles out of bounds
	bubbles = bubbles.filter((b) => !b.outOfBounds(canvas.width, canvas.height));
	updateAllBubbles();

	// Very slow movement
	if (fastestBubbleVelocity() < slowSpeedThreshold && isWaiting) {
		for (let i = 0; i < 2; i++) {
			updateAllBubbles();
		}
	}
	if (fastestBubbleVelocity() < stopSpeedThreshold && isWaiting) {
		// (basically) no movement => change turns

		// TODO: instead only speedup the game (maybe with an indicator so that it is obvious)
		// Simulate 1000 frames so you don't have to wait for everything to completely stop
		for (let i = 0; i < 1000; i++) {
			updateAllBubbles();
		}
		firstBounce = true;
		isWaiting = false;
		// Make a save state after settling
		saveStateBeforeShot = getSaveState();
		// FIXME: doesn't getWinner() already check for a draw?
		// Win checking (no bubbles=>draw,else getWinner())
		if (bubbles.length === 0) {
			winGame(0);
		} else {
			const winner = getWinner();
			if (winner !== 0) {
				winGame(winner);
			}
		}
	}
}
// Handles rendering of all objects and other stuff like the charge up lines
function render(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
	// Reset screen
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

	ctx.drawImage(offscreenCanvas, 0, 0);

	// Lines between nearby bubbles
	if (renderLinesBetween) {
		const maxDistance = 300;
		ctx.lineWidth = 2;
		for (let pn = 1; pn <= 2; pn++) {
			const playerBubbles = bubbles.filter((b) => b.player === pn);
			ctx.beginPath();
			ctx.strokeStyle = `rgba(0, 0, 0, ${0.2})`;
			playerBubbles.forEach((b1, i) => {
				for (const b2 of playerBubbles.slice(i + 1)) {
					const distance = b1.pos.sub(b2.pos).length();
					if (distance <= maxDistance) {
						ctx.moveTo(Math.floor(b1.pos.x), Math.floor(b1.pos.y));
						ctx.lineTo(Math.floor(b2.pos.x), Math.floor(b2.pos.y));
					}
				}
			});
			ctx.stroke();
		}
	}

	// Render objects using their functions
	for (const bubble of bubbles) {
		if (bubble.player === currentPlayer && !isWaiting) {
			ctx.fillStyle = "rgba(0,0,0,0.3)";
			drawCircle(
				ctx,
				bubble.pos,
				bubble.radius + bubble.radius * 0.15 * (Math.sin(frame / 250) + 1),
			);
		}
		bubble.render(ctx, getBallSprite(bubble.spriteIndex));
	}

	// Dragging line and hit indicator
	if (clickedBub) {
		const bubPos = clickedBub.pos;
		// const end = bubPos.add(bubPos.sub(mousePos))
		const maxRaycast = new Vector(canvas.width, canvas.height).length();
		const raycastEnd = bubPos.add(
			bubPos.sub(mousePos).mult(chargeDir).normalize().mult(maxRaycast),
		);
		const raycastHit = raycastSphere(
			bubPos,
			raycastEnd,
			clickedBub.radius,
			clickedBub,
			200,
		);
		// Draws a transparent bubble where the raycast hit
		if (raycastHit) {
			ctx.fillStyle =
				clickedBub.player === 2
					? "rgba(158, 152, 250, 0.3)"
					: "rgba(250, 163, 152, 0.3)";
			drawCircle(ctx, raycastHit, clickedBub.radius);
		}
		let vecBetween = bubPos.sub(mousePos);

		ctx.strokeStyle = "rgb(0 0 0)";
		if (vecBetween.length() > maxVelocityLen) {
			vecBetween = vecBetween.normalize().mult(maxVelocityLen);
			ctx.strokeStyle = "rgb(120 0 0)";
		}
		const lengthRatio = vecBetween.length() / maxVelocityLen;
		let end = bubPos.add(vecBetween.mult(chargeDir));
		ctx.beginPath();
		ctx.setLineDash([5 + 5 * lengthRatio, 17 * lengthRatio]);
		ctx.lineWidth = 6;
		ctx.moveTo(bubPos.x, bubPos.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// Draw a fast forward indicator at the top of the screen (when fast forwarding)
	if (fastestBubbleVelocity() < slowSpeedThreshold && isWaiting) {
		ctx.save();
		ctx.fillStyle = "rgba(43, 38, 38, 0.9)";

		const spacing = 20;
		const centerX = canvas.width / 2 + spacing / 2;
		const centerY = 120;
		const triangleSize = 80;

		// First triangle (left)
		ctx.beginPath();
		ctx.moveTo(centerX - spacing - triangleSize, centerY - triangleSize / 2);
		ctx.lineTo(centerX - spacing, centerY);
		ctx.lineTo(centerX - spacing - triangleSize, centerY + triangleSize / 2);
		ctx.closePath();
		ctx.fill();

		// Second triangle (right)
		ctx.beginPath();
		ctx.moveTo(centerX + spacing, centerY - triangleSize / 2);
		ctx.lineTo(centerX + spacing + triangleSize, centerY);
		ctx.lineTo(centerX + spacing, centerY + triangleSize / 2);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}
}
// End screen - shows who won
function renderEnd(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(offscreenCanvas, 0, 0);

	let message = "";
	if (winningPlayer === 0) {
		message = "Draw";
	} else if (winningPlayer === 1) {
		message = "Player 1 won!";
	} else {
		message = "Player 2 won!";
	}
	ctx.fillStyle = "black";
	ctx.textAlign = "center";
	ctx.font = 'bold 120px "verdana", sans-serif';
	ctx.fillText(message, canvas.width / 2, canvas.height / 2);
	ctx.font = '60px "verdana", sans-serif';
	ctx.fillText(
		"Click to continue...",
		canvas.width / 2,
		(canvas.height * 2) / 3,
	);
}
function renderStart(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(offscreenCanvas, 0, 0);
	for (const button of buttons) {
		button.render(ctx);
	}
	for (const previewBubble of previewBubbles) {
		previewBubble.render(ctx, getBallSprite(previewBubble.spriteIndex));
	}

	ctx.fillStyle = "black";
	ctx.textAlign = "center";
	ctx.font = 'bold 100px "Helvetica", sans-serif';
	ctx.fillText("Bubble Bounce", canvas.width / 2, canvas.height / 10);
}

// TODO: make exclude an array and optional
/// Uses a 'Bubble' for checking for collisions with other bubbles and blocks along the raycast
function raycastSphere(from: Vector, to: Vector, radius: number, exclude: Bubble, steps = 100) {
	const dir = to.sub(from);
	const testBub = new Bubble(new Vector(), radius, new Vector(), 1);
	for (let i = 1; i <= steps; i++) {
		const progress = i / steps;
		const testPos = from.add(dir.mult(progress));
		testBub.pos = testPos;
		for (let bi = 0; bi < bubbles.length; bi++) {
			const otherBub = bubbles[bi];
			if (
				otherBub !== exclude &&
				testBub.isCollidingBubble(otherBub)
			) {
				return testBub.pos.mult(1);
			}
		}
		for (const block of blocks) {
			if (testBub.isCollidingBlock(block)) {
				return testBub.pos.mult(1);
			}
		}
	}
	return null;
}

function get_bubble_in_pos(pos: Vector) {
	for (let i = 0; i < bubbles.length; i++) {
		const b = bubbles[i];
		if (b.isInside(pos)) {
			return b;
		}
	}
	return null;
}



type Settings = {
	smallBallCount: number;
	enableMiddleBlocks: boolean;
	requiredBounce: boolean;
}

function getSettings(): Settings {
	const defaultSettings = {
		smallBallCount: presetBallCounts[2],
		enableMiddleBlocks: true,
		requiredBounce: false,
	};
	const savedSettings = LocalStorageManager.get<Settings>("bubble_bounce_settings");
	if (savedSettings) {
		return savedSettings;
	}
	return defaultSettings;
}

function loadSettings(settings: Settings) {
	smallBallCount = settings.smallBallCount;
	enableMiddleBlocks = settings.enableMiddleBlocks;
	requiredBounce = settings.requiredBounce;

	saveSettings();
}

function saveSettings() {
	LocalStorageManager.set("bubble_bounce_settings", {
		chosenSprites,
		smallBallCount,
		enableMiddleBlocks,
		requiredBounce,
	});
}

const zoomIn = () => {
	canvas.style.transform = "scale(1)";
};
const zoomOut = () => {
	canvas.style.transform = "scale(0.8)";
};


init();
setupInput();
// The main game loop
(() => {
	function main(tFrame: number) {
		window.requestAnimationFrame(main);
		if (!ctx) {
			throw new Error("Main loop: 2D context not found");
		}
		if (gameState === GameState.MainMenu) {
			renderStart(ctx);
		} else if (gameState === GameState.Game) {
			update(tFrame);
			render(ctx);
		} else if (gameState === GameState.EndScreen) {
			renderEnd(ctx);
		}
	}

	main(0);
})();
