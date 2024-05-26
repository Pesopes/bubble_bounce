// bublinky různé velikosti, kliknutí se rozpadnou na menší

const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

const worker = new Worker("worker.js");
const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
let mousePos = new Vector();

const bubbles = [];
const blocks = [];

let chargeDir = -1;
const gravity = 0.0;
const drag = 0.99;
const damping = 0.99;
const backgroundImage = new Image();

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
		ctx.fillStyle = "white";
		drawRoundedRect(
			ctx,
			this.pos.x,
			this.pos.y,
			this.dim.x,
			this.dim.y,
			this.borderRadius,
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
	constructor(pos, radius, velocity, spriteSrc) {
		this.pos = pos;
		this.radius = radius;
		this.velocity = velocity;
		this.sprite = new Image();
		this.sprite.src = spriteSrc || "./balls/1.png";
		this.rotSpeed = 0;
	}
	mass() {
		return (Math.PI * this.radius * this.radius) / 1000000;
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

			//Eye candy
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
		ctx.fillStyle = "rgb(200 0 0)";
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
// TODO: finish
function prepareOffscreenCanvas() {
	offscreenCanvas.width = canvas.width;
	offscreenCanvas.height = canvas.height;

	backgroundImage.src = "./bliss.jpg";
	const offCtx = offscreenCanvas.getContext("2d");
	console.log(offscreenCanvas);

	offCtx.drawImage(
		backgroundImage,
		0,
		0,
		offscreenCanvas.width,
		offscreenCanvas.height,
	);
	for (const block of blocks) {
		block.render(offCtx);
	}
	// const offscreen = canvas.transferControlToOffscreen();
}
function init() {
	resizeCanvas();
	for (let i = 0; i <= 10; i++) {
		bubbles.push(new Bubble(new Vector(300, 200), 50, new Vector()));
	}
	prepareBoard();
	prepareOffscreenCanvas();
}

// Called when resizing but currently static
function resizeCanvas() {
	canvas.height = 1600;
	canvas.width = 950;
}
// Generic update func, handles collision
function update(tFrame) {
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
	bubbles.forEach((b1, i) => {
		for (b2 of bubbles.slice(i + 1)) {
			const maxDistance = 400;
			const distance = b1.pos.sub(b2.pos).length();
			if (distance > maxDistance) return;
			ctx.beginPath();
			ctx.strokeStyle = `rgba(0, 0, 0, ${1 - distance / maxDistance})`;
			ctx.lineWidth = 1;
			ctx.moveTo(b1.pos.x, b1.pos.y);
			ctx.lineTo(b2.pos.x, b2.pos.y);
			ctx.stroke();
		}
	});

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
