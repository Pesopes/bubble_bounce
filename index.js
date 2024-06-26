const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

// Used for background and static objects (meant to improve performance)
const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
const offCtx = offscreenCanvas.getContext("2d", { alpha: false });

// Touch event stuff
let mousePos = new Vector();
let evCache = [];
let previousEvDistance = -1;
let startingTouchCenter = new Vector();

// Spawned objects
let bubbles = [];
let blocks = [];
let buttons = [];
let previewBubbles = [];

// game state
let frame = 0;
let gameState = 0;
let winningPlayer = 0;
let currentPlayer = Math.round(Math.random()) + 1;
let isWaiting = false;

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
// Visual settings
let chosenSprites = [];
let renderLinesBetween = true;
let chargeDir = -1;

// Physics settings
const gravity = 0.0;
const drag = 0.992;
const damping = 0.96;

const fireForce = 18;

const backgroundImage = new Image();

// These are the "names" of sprites that will be used
// Since I named the sprites using numbers I just generate an array of numbers and then filter out the sprites I don't want
const availableSprites = Array.from(new Array(32), (x, i) => i + 1).filter(
	(s) => s !== 9 && s !== 14 && s !== 15,
);
backgroundImage.src = "./abstract_dots.svg";
let clickedBub = null;

// Static obstacles for bubbles
class Block {
	pos;
	dim;
	borderRadius;
	constructor(pos, dim, borderRadius = 1) {
		this.pos = pos;
		this.dim = dim;
		this.borderRadius = borderRadius;
	}
	getCenter() {
		return this.pos.add(this.dim.div(2));
	}
	render(ctx) {
		ctx.fillStyle = "F0EBE3";
		drawRoundedRect(
			ctx,
			// Optimize
			Math.floor(this.pos.x),
			Math.floor(this.pos.y),
			this.dim.x,
			this.dim.y,
			this.borderRadius + 15,
		);
	}
}

// Clickable rectangle
class Button {
	pos;
	dim;
	onClick;
	text;
	color;
	borderRadius;
	constructor(pos, dim, text, onClick, color = "red", borderRadius = 55) {
		this.pos = pos;
		this.dim = dim;
		this.text = text;
		this.onClick = onClick;
		this.color = color;
		this.borderRadius = borderRadius;
	}
	getCenter() {
		return this.pos.add(this.dim.div(2));
	}
	isInside(checkPos) {
		return (
			checkPos.x >= this.pos.x &&
			checkPos.x <= this.pos.x + this.dim.x &&
			checkPos.y >= this.pos.y &&
			checkPos.y <= this.pos.y + this.dim.y
		);
	}
	// If is vec in bounds call onClick
	checkClick(pos = mousePos) {
		if (this.isInside(pos)) {
			this.onClick(this);
		}
	}
	render(ctx) {
		ctx.fillStyle = this.color;
		drawRoundedRect(
			ctx,
			// Optimize
			Math.floor(this.pos.x),
			Math.floor(this.pos.y),
			this.dim.x,
			this.dim.y,
			this.borderRadius,
		);
		ctx.fillStyle = "black";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${Math.floor(this.dim.y / 3)}px "verdana", sans-serif`;
		const fontMeasurement = ctx.measureText(this.text);
		const center = this.getCenter();
		ctx.fillText(this.text, center.x, center.y, this.dim.x);
	}
}

// Moving balls that you play with
class Bubble {
	pos;
	radius;
	velocity;
	sprite;
	rotSpeed;
	rot;
	player;
	bouncedOffWall;
	constructor(pos, radius, velocity, spriteSrc, player = 0) {
		this.pos = pos;
		this.radius = radius;
		this.velocity = velocity;
		this.sprite = new Image();
		this.sprite.src = spriteSrc || "./balls/2.png";
		this.rotSpeed = 0;
		this.player = player;
	}

	mass() {
		return (Math.PI * this.radius * this.radius) / 100;
	}

	kineticEnergy() {
		return (this.mass() / 2) * this.velocity.squared();
	}

	bounce() {
		if (this.pos.x - this.radius <= 0) {
			this.velocity.x *= -damping;
			this.pos.x = this.radius;
		}
		if (this.pos.x + this.radius >= canvas.width) {
			this.velocity.x *= -damping;
			this.pos.x = canvas.width - this.radius;
		}
		if (this.pos.y - this.radius <= 0) {
			this.velocity.y *= -damping;
			this.pos.y = this.radius;
		}
		if (this.pos.y + this.radius >= canvas.height) {
			this.velocity.y *= -damping;
			this.pos.y = canvas.height - this.radius;
		}
	}
	// If the ball is mostly outside (there's some leeway)
	outOfBounds() {
		const safeDistance = this.radius + this.radius / 3;
		if (
			this.pos.x - this.radius + safeDistance <= 0 ||
			this.pos.x + this.radius - safeDistance >= canvas.width ||
			this.pos.y - this.radius + safeDistance <= 0 ||
			this.pos.y + this.radius - safeDistance >= canvas.height
		) {
			//TODO: death animation
			return true;
		}
		return false;
	}
	isCollidingBubble(other) {
		const vec = this.pos.sub(other.pos);
		const minDistance = this.radius + other.radius;
		const distance = vec.length();
		return distance <= minDistance;
	}
	// Unnecessary code copying from collision resolution (TODO: fix)
	isCollidingBlock(block) {
		const borderRadius = block.borderRadius;
		let collisionDetected = false;
		let normal = new Vector(0, 0);
		let penetrationDepth = 0;

		// Check collision with rectangle edges (excluding corners)
		const px = Math.max(
			block.pos.x + borderRadius,
			Math.min(this.pos.x, block.pos.x + block.dim.x - borderRadius),
		);
		const py = Math.max(
			block.pos.y + borderRadius,
			Math.min(this.pos.y, block.pos.y + block.dim.y - borderRadius),
		);
		const collisionPoint = new Vector(px, py);
		const dist = this.pos.sub(collisionPoint).length();

		if (dist <= this.radius) {
			collisionDetected = true;

			// Determine the collision normal for edges
			if (px === block.pos.x + borderRadius) {
				normal = new Vector(-1, 0); // Left edge
			} else if (px === block.pos.x + block.dim.x - borderRadius) {
				normal = new Vector(1, 0); // Right edge
			} else if (py === block.pos.y + borderRadius) {
				normal = new Vector(0, -1); // Top edge
			} else if (py === block.pos.y + block.dim.y - borderRadius) {
				normal = new Vector(0, 1); // Bottom edge
			}

			penetrationDepth = this.radius - dist;
		}

		// Check collision with rectangle corners
		const corners = [
			new Vector(block.pos.x + borderRadius, block.pos.y + borderRadius), // Top-left
			new Vector(
				block.pos.x + block.dim.x - borderRadius,
				block.pos.y + borderRadius,
			), // Top-right
			new Vector(
				block.pos.x + borderRadius,
				block.pos.y + block.dim.y - borderRadius,
			), // Bottom-left
			new Vector(
				block.pos.x + block.dim.x - borderRadius,
				block.pos.y + block.dim.y - borderRadius,
			), // Bottom-right
		];

		for (const corner of corners) {
			const cornerDist = this.pos.sub(corner).length();
			if (cornerDist <= this.radius + borderRadius) {
				collisionDetected = true;
				normal = this.pos.sub(corner).normalize();
				penetrationDepth = this.radius + borderRadius - cornerDist;
				break;
			}
		}

		return collisionDetected;
	}
	// BUG: collision with sides is offset by borderRadius (especially visible with a high borderRadius)
	// Handle collision with a Block
	collideBlock(block) {
		const borderRadius = block.borderRadius;
		let collisionDetected = false;
		let normal = new Vector(0, 0);
		let penetrationDepth = 0;

		// Check collision with rectangle edges (excluding corners)
		const px = Math.max(
			block.pos.x + borderRadius,
			Math.min(this.pos.x, block.pos.x + block.dim.x - borderRadius),
		);
		const py = Math.max(
			block.pos.y + borderRadius,
			Math.min(this.pos.y, block.pos.y + block.dim.y - borderRadius),
		);
		const collisionPoint = new Vector(px, py);
		const dist = this.pos.sub(collisionPoint).length();

		if (dist <= this.radius) {
			collisionDetected = true;

			// Determine the collision normal for edges
			if (px === block.pos.x + borderRadius) {
				normal = new Vector(-1, 0); // Left edge
			} else if (px === block.pos.x + block.dim.x - borderRadius) {
				normal = new Vector(1, 0); // Right edge
			} else if (py === block.pos.y + borderRadius) {
				normal = new Vector(0, -1); // Top edge
			} else if (py === block.pos.y + block.dim.y - borderRadius) {
				normal = new Vector(0, 1); // Bottom edge
			}

			penetrationDepth = this.radius - dist;
		}

		// Check collision with rectangle corners
		const corners = [
			new Vector(block.pos.x + borderRadius, block.pos.y + borderRadius), // Top-left
			new Vector(
				block.pos.x + block.dim.x - borderRadius,
				block.pos.y + borderRadius,
			), // Top-right
			new Vector(
				block.pos.x + borderRadius,
				block.pos.y + block.dim.y - borderRadius,
			), // Bottom-left
			new Vector(
				block.pos.x + block.dim.x - borderRadius,
				block.pos.y + block.dim.y - borderRadius,
			), // Bottom-right
		];

		for (const corner of corners) {
			const cornerDist = this.pos.sub(corner).length();
			if (cornerDist <= this.radius + borderRadius) {
				collisionDetected = true;
				normal = this.pos.sub(corner).normalize();
				penetrationDepth = this.radius + borderRadius - cornerDist;
				break;
			}
		}

		if (collisionDetected) {
			// Correct the position by moving the circle back along the normal
			this.pos = this.pos.add(normal.mult(penetrationDepth));

			// Reflect the velocityocity
			const dotProduct = this.velocity.dot(normal);
			this.velocity = this.velocity.sub(normal.mult(2 * dotProduct));

			// Optionally, apply a damping factor to simultate energy loss
			this.velocity = this.velocity.mult(damping);

			this.bouncedOffWall = true;
		}
	}
	// Handle collision with another Bubble
	collideBubble(other) {
		const vec = this.pos.sub(other.pos);
		const minDistance = this.radius + other.radius;
		const distance = vec.length();
		if (distance <= minDistance) {
			//my collision sucked so chatGPT wrote this
			const collisionNormal = vec.normalize();

			// Calculate relative velocity
			const relativeVelocity = this.velocity.sub(other.velocity);

			// Calculate the velocity change based on the relative velocity and masses
			const velocityChange = collisionNormal.mult(
				(2 * relativeVelocity.dot(collisionNormal)) /
					(this.mass() + other.mass()),
			);

			// Apply velocity change to the velocities of both balls
			this.velocity = this.velocity.sub(velocityChange.mult(other.mass()));
			other.velocity = other.velocity.add(velocityChange.mult(this.mass()));

			// Separate the balls to avoid overlap
			const overlap = minDistance - distance;
			const separation = collisionNormal.mult(overlap / 2);
			this.pos = this.pos.add(separation);
			other.pos = other.pos.sub(separation);

			//Eye candy - rotation
			const rotDiff = velocityChange
				.normalize()
				.dot(new Vector(-this.velocity.y, this.velocity.x).normalize());
			this.rotSpeed = rotDiff / 100;
			other.rotSpeed = rotDiff / 100;
		}
	}

	update() {
		// this.bounce();
		this.velocity.y += gravity * this.mass();
		this.velocity = this.velocity.mult(drag);
		this.rotSpeed *= drag;
		this.rot += this.rotSpeed;
		this.pos = this.pos.add(this.velocity);
	}

	render(ctx) {
		//TODO: color
		// drawCircle(ctx,this.pos, this.radius)
		// ctx.fillStyle = "rgb(200 0 0)";
		this.rot = this.rot || Math.PI * 2 * Math.random();

		if (this.player === currentPlayer && !isWaiting) {
			ctx.fillStyle = "rgba(0,0,0,0.3)";
			drawCircle(
				ctx,
				this.pos,
				this.radius + this.radius * 0.3 * Math.abs(Math.sin(frame / 500)),
			);
		}
		drawImage(ctx, this.sprite, this.pos, this.radius * 2, this.rot);
	}

	simpleRender(ctx) {
		ctx.fillStyle = color;
		drawCircle(ctx, this.pos, this.radius);
	}

	isInside(pos) {
		const dist = pos.sub(this.pos).length();
		return dist <= this.radius;
	}
}

const isColliding = (testBub) => {
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
// Converts a number to sprite path 
function getSprite(num) {
	return `./balls/${availableSprites[num]}.png`;
}
// Generic draw image
function drawImage(ctx, img, pos, scale, rotation) {
	ctx.save();
	ctx.translate(Math.floor(pos.x), Math.floor(pos.y));
	ctx.rotate(rotation);
	ctx.drawImage(img, -scale / 2, -scale / 2, scale, scale);
	ctx.restore();
}
// Generic draw circle
function drawCircle(ctx, pos, radius) {
	ctx.beginPath();
	ctx.arc(Math.floor(pos.x), Math.floor(pos.y), radius, 0, Math.PI * 2);
	ctx.fill();
}

// Generic draw rounded rect
function drawRoundedRect(ctx, x, y, width, height, borderRadius) {
	// Begin path
	ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";
	ctx.lineWidth = 6;
	ctx.beginPath();
	// Top side
	ctx.moveTo(x + borderRadius, y);
	ctx.lineTo(x + width - borderRadius, y);
	// Top right corner
	ctx.arcTo(x + width, y, x + width, y + borderRadius, borderRadius);
	// Right side
	ctx.lineTo(x + width, y + height - borderRadius);
	// Bottom right corner
	ctx.arcTo(
		x + width,
		y + height,
		x + width - borderRadius,
		y + height,
		borderRadius,
	);
	// Bottom side
	ctx.lineTo(x + borderRadius, y + height);
	// Bottom left corner
	ctx.arcTo(x, y + height, x, y + height - borderRadius, borderRadius);
	// Left side
	ctx.lineTo(x, y + borderRadius);
	// Top left corner
	ctx.arcTo(x, y, x + borderRadius, y, borderRadius);
	ctx.stroke();
	ctx.fill();
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
			(but) => {
				resetGame();
				gameState = 1;
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
			},

			requiredBounce ? onColor : offColor,
		),
	);
	// CHANGE BALL COUNT BUTTONS
	const startingBallCountRatio =
		smallBallCount / presetBallCounts[presetBallCounts.length - 1];
	const ballCountColor = `rgb(${
		-startingBallCountRatio * 100 + 200
	}, ${233}, ${203})`;
	buttons.push(
		new Button(
			new Vector(
				(canvas.width - buttonDim.x) / 2,
				canvas.height - buttonDim.y * 3 - 400 - spacing * 2,
			),
			buttonDim,
			`Small balls: ${smallBallCount}`,
			(but) => {
				const currentIndex = presetBallCounts.indexOf(smallBallCount);
				smallBallCount =
					presetBallCounts[(currentIndex + 1) % presetBallCounts.length];
				const ballCountRatio =
					smallBallCount / presetBallCounts[presetBallCounts.length - 1];
				but.color = `rgb(${-ballCountRatio * 100 + 200}, ${233}, ${203})`;
				but.text = `Small balls: ${smallBallCount}`;
			},

			ballCountColor,
		),
	);
	//
	// PREVIEW BALLS AND BUTTONS
	// There are two balls each with two buttons to cycle all availableSprites and choose
	const previewPosCenter = new Vector(canvas.width / 2, 350);

	const previewButtonSwitchDim = new Vector(80, bigBallSize * 2);
	const previewButtonColor = "#dbedd0";
	const previewBubbleOffset = 200;
	// Get random starting sprites that are different to each other
	if (chosenSprites.length === 0) {
		chosenSprites[0] = Math.floor(Math.random() * availableSprites.length);
		do {
			chosenSprites[1] = Math.floor(Math.random() * availableSprites.length);
		} while (chosenSprites[0] === chosenSprites[1]);
	}

	// Do for both players
	for (let i = 0; i <= 1; i++) {
		const sign = i * 2 - 1; // p1=>-1;p2=>1
		previewBubbles.push(
			new Bubble(
				previewPosCenter.add(new Vector(sign * previewBubbleOffset, 0)),
				bigBallSize,
				new Vector(),
				getSprite(chosenSprites[i]),
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
				(but) => {
					chosenSprites[i] = (chosenSprites[i] - 1) % availableSprites.length;
					if (chosenSprites[i] < 0)
						chosenSprites[i] = availableSprites.length - 1;
					previewBubbles[i].sprite.src = getSprite(chosenSprites[i]);
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
				(but) => {
					chosenSprites[i] = (chosenSprites[i] + 1) % availableSprites.length;
					previewBubbles[i].sprite.src = getSprite(chosenSprites[i]);
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
backgroundImage.onload = (e) => {
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
	if (enableMiddleBlocks && gameState !== 2) {
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
function spawnPlayerBalls(center, playerSprite, playerNum, top) {
	// Converts bool to int (-1 or 1)
	const side = +top * 2 - 1;
	const newBub = new Bubble(
		center,
		bigBallSize,
		new Vector(),
		playerSprite,
		playerNum,
	);
	bubbles.push(newBub);
	// Medium balls in front of big one
	for (i = 0; i <= 5; i++) {
		bubbles.push(
			new Bubble(
				new Vector(
					(i / 5) * canvas.width,
					center.y + (distanceFromSide / 2) * side,
				),
				mediumBallSize,
				new Vector(),
				playerSprite,
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
			playerSprite,
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

	prepareBoard();

	prepareStart();
	const topPlayerCenter = new Vector(canvas.width / 2, distanceFromSide);
	const bottomPlayerCenter = new Vector(
		canvas.width / 2,
		canvas.height - distanceFromSide,
	);
	spawnPlayerBalls(topPlayerCenter, getSprite(chosenSprites[0]), 1, true);
	spawnPlayerBalls(bottomPlayerCenter, getSprite(chosenSprites[1]), 2, false);
}
function resetGame() {
	gameState = 0;
	bubbles = [];
	blocks = [];
	buttons = [];
	previewBubbles = [];

	currentPlayer = Math.round(Math.random()) + 1;
	init();
	prepareOffscreenCanvas();
}
// Called when resizing but currently static
function resizeCanvas() {
	canvas.height = 1600;
	canvas.width = 950;
}
function winGame(player) {
	gameState = 2;
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
const allStopped = () => {
	for (const bubble of bubbles) {
		if (bubble.velocity.length() > 0.24) return false;
	}
	return true;
};

const getWinner = () => {
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
	if (anyPlayer1 ^ anyPlayer2) {
		if (anyPlayer1) {
			return 2;
		}
		return 1;
	}
	return 0;
};
function updateAllBubbles() {
	bubbles.forEach((b1, i) => {
		b1.update();
		for (const b2 of bubbles.slice(i + 1)) {
			b1.collideBubble(b2);
		}
		for (const block of blocks) {
			b1.collideBlock(block);
		}
	});
}
// Generic update func, handles collision
function update(tFrame) {
	frame = tFrame;
	// Delete bubbles out of bounds
	bubbles = bubbles.filter((b) => !b.outOfBounds());
	updateAllBubbles();
	// (almost) no movement => other player can play
	if (allStopped() && isWaiting) {
		// Simulate 1000 frames so you don't have to wait for everything to completely stop
		for (i = 0; i < 1000; i++) {
			updateAllBubbles();
		}
		isWaiting = false;
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
function render(ctx) {
	// Reset screen
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

	ctx.drawImage(offscreenCanvas, 0, 0);

	// Lines between nearby bubbles
	if (renderLinesBetween) {
		const maxDistance = 600;
		for (pn = 1; pn <= 2; pn++) {
			const playerBubbles = bubbles.filter((b) => b.player === pn);
			playerBubbles.forEach((b1, i) => {
				for (const b2 of playerBubbles.slice(i + 1)) {
					const distance = b1.pos.sub(b2.pos).length();
					if (distance <= maxDistance) {
						ctx.beginPath();
						ctx.strokeStyle = `rgba(0, 0, 0, ${1 - distance / maxDistance})`;
						ctx.lineWidth = 1;
						ctx.moveTo(Math.floor(b1.pos.x), Math.floor(b1.pos.y));
						ctx.lineTo(Math.floor(b2.pos.x), Math.floor(b2.pos.y));
						ctx.stroke();
					}
				}
			});
		}
	}

	// Render objects using their functions
	for (bub of bubbles) {
		bub.render(ctx);
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
		end = bubPos.add(vecBetween.mult(chargeDir));
		ctx.beginPath();
		ctx.setLineDash([5 + 5 * lengthRatio, 17 * lengthRatio]);
		ctx.lineWidth = 6;
		ctx.moveTo(bubPos.x, bubPos.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}
// End screen - shows who won
function renderEnd(ctx) {
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
function renderStart(ctx) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(offscreenCanvas, 0, 0);
	for (const button of buttons) {
		button.render(ctx);
	}
	for (const previewBubble of previewBubbles) {
		previewBubble.render(ctx);
	}

	ctx.fillStyle = "black";
	ctx.textAlign = "center";
	ctx.font = 'bold 100px "Helvetica", sans-serif';
	ctx.fillText("Bubble Bounce", canvas.width / 2, canvas.height / 8);
}
function randomFromArray(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}
function raycastSphere(from, to, radius, exclude, steps = 100) {
	const dir = to.sub(from);
	const testBub = new Bubble(new Vector(), radius);
	for (let i = 1; i <= steps; i++) {
		const progress = i / steps;
		const testPos = from.add(dir.mult(progress));
		testBub.pos = testPos;
		for (let bi = 0; bi < bubbles.length; bi++) {
			const otherBub = bubbles[bi];
			if (
				JSON.stringify(otherBub) !== JSON.stringify(exclude) &&
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

function get_bubble_in_pos(pos) {
	for (let i = 0; i < bubbles.length; i++) {
		const b = bubbles[i];
		if (b.isInside(pos)) {
			return b;
		}
	}
	return null;
}

function convertEventPos(event) {
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;

	return new Vector(
		(event.clientX - rect.left) * scaleX,
		(event.clientY - rect.top) * scaleY,
	);
}

window.addEventListener("resize", resizeCanvas);
document.addEventListener("pointermove", (e) => {
	mousePos = convertEventPos(e);
});

// start aiming (saves the clicked bubble)
document.addEventListener("pointerdown", (e) => {
	evCache.push(e);
	if (evCache.length === 2) {
		startingTouchCenter = convertEventPos(evCache[0]).add(
			convertEventPos(evCache[1]).sub(convertEventPos(evCache[0])).div(2),
		);
	}
	mousePos = convertEventPos(e);

	if (gameState === 0) {
		for (const button of buttons) {
			button.checkClick(convertEventPos(e));
		}
		return;
	}
	if (gameState === 2) {
		resetGame();
		return;
	}
	if (!isWaiting) {
		clickedBub = get_bubble_in_pos(mousePos);
		if (clickedBub && clickedBub.player !== currentPlayer) {
			clickedBub = null;
		}
	}
});
function removeEvent(ev) {
	// Remove this event from the target's cache
	const index = evCache.findIndex(
		(cachedEv) => cachedEv.pointerId === ev.pointerId,
	);
	evCache.splice(index, 1);
}
// Stopped aiming -> shoot
document.addEventListener("pointerup", (e) => {
	mousePos = convertEventPos(e);
	removeEvent(e);
	if (evCache.length < 2) {
		previousEvDistance = -1;
	}
	if (clickedBub) {
		const dirVec = clickedBub.pos.sub(mousePos).mult(chargeDir);
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
});
const zoomIn = () => {
	canvas.style.transform = "scale(1)";
};
const zoomOut = () => {
	canvas.style.transform = "scale(0.8)";
};
document.addEventListener("pointermove", (e) => {
	const index = evCache.findIndex(
		(cachedE) => cachedE.pointerId === e.pointerId,
	);
	evCache[index] = e;
	if (evCache.length === 2) {
		const firstTouch = new Vector(evCache[0].clientX, evCache[0].clientY);
		const secondTouch = new Vector(evCache[1].clientX, evCache[1].clientY);
		const diff = firstTouch.sub(secondTouch).length();
		const neededDistance = 13;
		if (previousEvDistance > 0) {
			if (diff > previousEvDistance + neededDistance) {
				zoomIn();
			}

			if (diff < previousEvDistance - neededDistance) {
				zoomOut();
			}
		}
		previousEvDistance = diff;
	}
});
document.addEventListener("wheel", (event) => {
	if (event.deltaY < 0) {
		zoomIn();
	} else {
		zoomOut();
	}
});
init();
// The main game loop
(() => {
	function main(tFrame) {
		window.requestAnimationFrame(main);

		if (gameState === 0) {
			renderStart(ctx);
		} else if (gameState === 1) {
			update(tFrame);
			render(ctx);
		} else if (gameState === 2) {
			renderEnd(ctx);
		}
	}

	main();
})();
