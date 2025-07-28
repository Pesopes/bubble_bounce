import { gravity, damping, drag } from "./constants";


export class Vector {
  x;
  y;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector(this.x, this.y);
  }

  squared() {
    return this.x * this.x + this.y * this.y
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  normalize() {
    var m = this.length();
    if (m > 0) {
      return this.div(m);
    } else {
      return new Vector(this.x, this.y)
    }
  }

  div(a: Vector | number) {
    if (a instanceof Vector) {
      return new Vector(this.x / a.x, this.y / a.y)
    } else {
      return new Vector(this.x / a, this.y / a)
    }
  }
  mult(a: Vector | number) {
    if (a instanceof Vector) {
      return new Vector(this.x * a.x, this.y * a.y)
    } else {
      return new Vector(this.x * a, this.y * a)
    }
  }

  add(a: Vector | number) {
    if (a instanceof Vector) {
      return new Vector(this.x + a.x, this.y + a.y)

    } else {
      return new Vector(this.x + a, this.y + a)
    }
  }

  sub(a: Vector | number) {
    if (a instanceof Vector) {
      return new Vector(this.x - a.x, this.y - a.y)
    } else {
      return new Vector(this.x - a, this.y - a)
    }
  }

  negate() {
    return new Vector(-this.x, -this.y)
  }

  dot(a: Vector) {
    return this.x * a.x + this.y * a.y
  }

  static lerp(a: Vector, b: Vector, t: Vector | number) {
    return a.add(b.sub(a).mult(t))
  }
}

// Static obstacles for bubbles
export class Block {
  pos;
  dim;
  borderRadius;
  constructor(pos: Vector, dim: Vector, borderRadius = 1) {
    this.pos = pos;
    this.dim = dim;
    this.borderRadius = borderRadius;
  }
  clone() {
    return new Block(this.pos.clone(), this.dim.clone(), this.borderRadius);
  }
  getCenter() {
    return this.pos.add(this.dim.div(2));
  }
  render(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
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
export class Button {
  pos;
  dim;
  onClick;
  text;
  color;
  borderRadius;
  constructor(pos: Vector, dim: Vector, text: string, onClick: (btn: Button) => void, color = "red", borderRadius = 55) {
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
  isInside(checkPos: Vector) {
    return (
      checkPos.x >= this.pos.x &&
      checkPos.x <= this.pos.x + this.dim.x &&
      checkPos.y >= this.pos.y &&
      checkPos.y <= this.pos.y + this.dim.y
    );
  }
  // If is vec in bounds call onClick
  checkClick(pos: Vector) {
    if (this.isInside(pos)) {
      this.onClick(this);
    }
  }
  render(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
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
    // somehow use this to make sure the text fits
    // const fontMeasurement = ctx.measureText(this.text);
    const center = this.getCenter();
    ctx.fillText(this.text, center.x, center.y, this.dim.x);
  }
}

// Moving balls that you play with
export class Bubble {
  pos;
  radius;
  velocity;
  spriteIndex;
  rotSpeed;
  rot: number = 0;
  player;
  bouncedOffWall: boolean = false;
  constructor(pos: Vector, radius: number, velocity: Vector, spriteIndex: number, player = 0) {
    this.pos = pos;
    this.radius = radius;
    this.velocity = velocity;
    this.spriteIndex = spriteIndex;
    this.rotSpeed = 0;
    this.player = player;
  }

  clone() {
    const newBubble = new Bubble(
      this.pos.clone(),
      this.radius,
      this.velocity.clone(),
      this.spriteIndex,
      this.player,
    );
    newBubble.rot = this.rot;
    newBubble.rotSpeed = this.rotSpeed;
    newBubble.bouncedOffWall = this.bouncedOffWall;
    return newBubble;
  }

  mass() {
    return (Math.PI * this.radius * this.radius) / 100;
  }

  kineticEnergy() {
    return (this.mass() / 2) * this.velocity.squared();
  }


  // If the ball is mostly outside (there's some leeway)
  outOfBounds(width: number, height: number) {
    const safeDistance = this.radius + this.radius / 3;
    if (
      this.pos.x - this.radius + safeDistance <= 0 ||
      this.pos.x + this.radius - safeDistance >= width ||
      this.pos.y - this.radius + safeDistance <= 0 ||
      this.pos.y + this.radius - safeDistance >= height
    ) {
      //TODO: death animation
      return true;
    }
    return false;
  }
  isCollidingBubble(other: Bubble) {
    const vec = this.pos.sub(other.pos);
    const minDistance = this.radius + other.radius;
    const distance = vec.length();
    return distance <= minDistance;
  }
  // Unnecessary code copying from collision resolution (TODO: fix)
  isCollidingBlock(block: Block) {
    const borderRadius = block.borderRadius;
    let collisionDetected = false;

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
        break;
      }
    }

    return collisionDetected;
  }
  // BUG: collision with sides is offset by borderRadius (especially visible with a high borderRadius)
  // Handle collision with a Block
  collideBlock(block: Block): boolean {
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

      return true; // Collision occurred
    }
    return false; // No collision
  }
  // Handle collision with another Bubble
  collideBubble(other: Bubble): boolean {
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

      return true; // Collision occurred
    }
    return false; // No collision
  }

  update() {
    // this.bounce();
    this.velocity.y += gravity * this.mass();
    this.velocity = this.velocity.mult(drag);
    this.rotSpeed *= drag;
    this.rot += this.rotSpeed;
    this.pos = this.pos.add(this.velocity);
  }

  render(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, sprite: HTMLImageElement) {
    //TODO: color
    // drawCircle(ctx,this.pos, this.radius)
    // ctx.fillStyle = "rgb(200 0 0)";
    this.rot = this.rot ?? Math.PI * 2 * Math.random();


    drawImage(ctx, sprite, this.pos, this.radius * 2, this.rot);
  }

  simpleRender(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, color = "rgb(200 0 0)") {
    ctx.fillStyle = color;
    drawCircle(ctx, this.pos, this.radius);
  }

  isInside(pos: Vector) {
    const dist = pos.sub(this.pos).length();
    return dist <= this.radius;
  }
}

// Generic draw image
function drawImage(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, img: HTMLImageElement, pos: Vector, scale: number, rotation: number) {
  ctx.save();
  ctx.translate(Math.floor(pos.x), Math.floor(pos.y));
  ctx.rotate(rotation);
  ctx.drawImage(img, -scale / 2, -scale / 2, scale, scale);
  ctx.restore();
}
// Generic draw circle
export function drawCircle(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pos: Vector, radius: number) {
  ctx.beginPath();
  ctx.arc(Math.floor(pos.x), Math.floor(pos.y), radius, 0, Math.PI * 2);
  ctx.fill();
}

// Generic draw rounded rect
function drawRoundedRect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number, borderRadius: number) {
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