// bublinky různé velikosti, kliknutí se rozpadnou na menší

const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
const offCtx = offscreenCanvas.getContext("2d", { alpha: false });
let mousePos = new Vector();

let bubbles = [];
const blocks = [];

let renderLinesBetween = true;
let chargeDir = -1;
const gravity = 0.0;
const drag = 0.99;
const damping = 0.99;
const backgroundImage = new Image();

//determines how far it will spawn the balls based on the top/bottom border
const distanceFromSide = 300;

const bigBallSize = 75;
const mediumBallSize = 50;
const smallBallSize = 37;

const availableSprites = Array.from(new Array(32), (x, i) => i + 1);
backgroundImage.src = "./abstract_dots.svg";
let clickedBub = null;

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
		return pos.add(dim.div(2));
	}
	render(ctx) {
		ctx.fillStyle = "F0EBE3";
		drawRoundedRect(
			ctx,
			this.pos.x,
			this.pos.y,
			this.dim.x,
			this.dim.y,
			this.borderRadius + 15,
		);
	}
}

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
		this.sprite.src = spriteSrc || "./balls/1.png";
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
	//BUG: collision with sides is offset by borderRadius (especially visible with a high borderRadius)
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
		drawImage(ctx, this.sprite, this.pos, this.radius * 2, this.rot);
	}

	simpleRender(ctx) {
		ctx.fillStyle = "blue";
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
function drawImage(ctx, img, pos, scale, rotation) {
	ctx.save();
	ctx.translate(pos.x, pos.y);
	ctx.rotate(rotation);
	ctx.drawImage(img, -scale / 2, -scale / 2, scale, scale);
	ctx.restore();
}

function drawCircle(ctx, pos, radius) {
	ctx.beginPath();
	ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
	ctx.fill();
}

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

function prepareBoard() {
	const sideBlockDim = new Vector(50, 700);
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

	const midBlockPos = new Vector(
		sideBlockOffset +
			sideBlockDim.x +
			Math.random() * (canvas.width - 2 * (sideBlockOffset - sideBlockDim.x)),
		(canvas.height - sideBlockDim.x) / 2,
	);

	// Spawn mid blocks
	blocks.push(
		new Block(
			midBlockPos,
			new Vector(rightBlockPos.x - midBlockPos.x, sideBlockDim.x),
		),
	);
}
backgroundImage.onload = (e) => {
	prepareOffscreenCanvas();
};
// TODO: finish
function prepareOffscreenCanvas() {
	offscreenCanvas.width = canvas.width;
	offscreenCanvas.height = canvas.height;
	offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
	offCtx.fillStyle = "#efe1e1";
	offCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
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
	for (const block of blocks) {
		block.render(offCtx);
	}
	// const offscreen = canvas.transferControlToOffscreen();
}
function spawnPlayerBalls(
	center,
	playerSprite,
	playerNum,
	top,
	smallCount = 10,
) {
	//converts bool to int
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
	// random small ones
	const iterMax = 100;
	let iterCount = 0;
	let iterAll = 0;
	while (iterCount <= smallCount && iterAll < iterMax) {
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
			console.log("AY");
			bubbles.push(newSmallBub);
		}
		iterAll++;
	}
}
function init() {
	resizeCanvas();
	prepareBoard();

	const topPlayerCenter = new Vector(canvas.width / 2, distanceFromSide);
	const bottomPlayerCenter = new Vector(
		canvas.width / 2,
		canvas.height - distanceFromSide,
	);
	const p1 =
		availableSprites[Math.floor(Math.random() * availableSprites.length)];
	const p2 = availableSprites.filter((n) => n !== p1)[
		Math.floor(Math.random() * availableSprites.length)
	];
	spawnPlayerBalls(topPlayerCenter, `./balls/${p1}.png`, 1, true);
	spawnPlayerBalls(bottomPlayerCenter, `./balls/${p2}.png`, 2, false);
}

// Called when resizing but currently static
function resizeCanvas() {
	canvas.height = 1600;
	canvas.width = 950;
}
// Generic update func, handles collision
function update(tFrame) {
	bubbles = bubbles.filter((b) => !b.outOfBounds());
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
// Handles rendering of all objects and other stuff like the charge up lines
function render(ctx) {
	// Reset screen
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

	ctx.drawImage(offscreenCanvas, 0, 0);

	// Lines between near bubbles
	if (renderLinesBetween) {
		for (pn = 1; pn <= 2; pn++) {
			bubbles
				.filter((b) => b.player === pn)
				.forEach((b1, i) => {
					for (const b2 of bubbles
						.filter((b) => b.player === pn)
						.slice(i + 1)) {
						const maxDistance = 600;
						const distance = b1.pos.sub(b2.pos).length();
						if (distance > maxDistance) return;
						ctx.beginPath();
						ctx.strokeStyle = `rgba(0, 0, 0, ${1 - distance / maxDistance})`;
						ctx.lineWidth = 2;
						ctx.moveTo(b1.pos.x, b1.pos.y);
						ctx.lineTo(b2.pos.x, b2.pos.y);
						ctx.stroke();
					}
				});
		}
	}

	// render objects using their functions
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
		if (raycastHit) {
			ctx.fillStyle = "blue";
			drawCircle(ctx, raycastHit, clickedBub.radius);
		}
		end = bubPos.add(bubPos.sub(mousePos).mult(chargeDir));
		ctx.beginPath();
		ctx.strokeStyle = "rgb(0 0 0)";
		ctx.lineWidth = 6;
		ctx.moveTo(bubPos.x, bubPos.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
	}
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

function getMousePos(event) {
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
	mousePos = getMousePos(e);
});

// start aiming (saves the clicked bubble)
document.addEventListener("pointerdown", (e) => {
	mousePos = getMousePos(e);

	clickedBub = get_bubble_in_pos(mousePos);
});
// Stopped aiming -> shoot
document.addEventListener("pointerup", (e) => {
	mousePos = getMousePos(e);

	if (clickedBub) {
		const maxVelocity = 18;
		const dirVec = clickedBub.pos.sub(mousePos).div(16).mult(chargeDir);
		clickedBub.velocity = dirVec
			.normalize()
			.mult(Math.min(dirVec.length(), maxVelocity));
		clickedBub = null;
		// if (dirVec.length() >= maxVelocity) {
		// 	console.log("MAXIMUM POWER");
		// }
	}
});
document.addEventListener("keydown", (e) => {
	// mousePos = new Vector(e.clientX, e.clientY)

	const newBub = new Bubble(mousePos.mult(1), 40, new Vector());
	newBub.sprite.src = `./balls/${Math.ceil(Math.random() * 32)}.png`;
	bubbles.push(newBub);
});
(() => {
	function main(tFrame) {
		window.requestAnimationFrame(main);

		update(tFrame);
		render(ctx);
	}

	main();
})();

init();
