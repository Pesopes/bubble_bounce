// bublinky různé velikosti, kliknutí se rozpadnou na menší

const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

let mousePos = new Vector()

let bubbles = []

let gravity = 0.0
const drag = 0.99
const damping = 0.99
const ballSprite = new Image()
const backgroundImage = new Image()


let startPos = null


class Bubble {
  pos
  radius
  velocity
  sprite
  rotSpeed
  rot
  constructor(pos, radius, velocity,spriteSrc) {
    this.pos = pos
    this.radius = radius
    this.velocity = velocity
    this.sprite = new Image()
    this.sprite.src = spriteSrc || "./balls/1.png"
    this.rotSpeed = 0
  }
  mass() {
    return Math.PI * this.radius * this.radius / 1000000
  }
  kineticEnergy(){
    return this.mass()/2*this.velocity.squared()
  }
  bounce() {
    if (this.pos.x - this.radius <= 0) {
      this.velocity.x *= -damping
      this.pos.x = this.radius
    }
    if (this.pos.x + this.radius >= canvas.width) {
      this.velocity.x *= -damping
      this.pos.x = canvas.width - this.radius
    }
    if (this.pos.y - this.radius <= 0) {
      this.velocity.y *= -damping
      this.pos.y = this.radius
    }
    if (this.pos.y + this.radius >= canvas.height) {
      this.velocity.y *= -damping
      this.pos.y = canvas.height - this.radius
    }
  }
  collide(other) {
    let vec = this.pos.sub(other.pos)
    const minDistance = this.radius + other.radius;
    const distance = vec.length()
    if (distance <= minDistance) {
      // console.log("BEFORE:",this.kineticEnergy()+other.kineticEnergy())
      //my collision sucked so chatGPT wrote this
      const collisionNormal = vec.normalize();

      // Calculate relative velocity
      let relativeVelocity = this.velocity.sub(other.velocity);

      // Calculate the velocity change based on the relative velocity and masses
      let velocityChange = collisionNormal.mult(2 * relativeVelocity.dot(collisionNormal) / (this.mass() + other.mass()));

      // Apply velocity change to the velocities of both balls
      this.velocity = this.velocity.sub(velocityChange.mult(other.mass()));
      other.velocity = other.velocity.add(velocityChange.mult(this.mass()));

      // Separate the balls to avoid overlap
      const overlap = minDistance - distance;
      const separation = collisionNormal.mult(overlap / 2);
      this.pos = this.pos.add(separation);
      other.pos = other.pos.sub(separation);
      // console.log("AFTER:",this.kineticEnergy()+other.kineticEnergy())

      //Eye candy
      const rotDiff = velocityChange.normalize().dot(new Vector(-this.velocity.y,this.velocity.x).normalize())
      this.rotSpeed = rotDiff / 100
      other.rotSpeed = rotDiff / 100
    }
  }
  // A physics experiment gone wrong...
  collidePhysicsVersion(other) {
    let vec = this.pos.sub(other.pos)
    const distance = vec.length()
    const minDistance = this.radius + other.radius;
    vec = vec.normalize()
    if (distance <= minDistance) {
      const M = other.mass() / this.mass()
      if (Math.abs(vec.x) < Math.abs(vec.y)){
        const R = -vec.x / vec.y
        const iM = 1 / M
        const iR = 1 / R
  
        const c1 = this.velocity.x + M * other.velocity.x
        const c2 = this.velocity.y + M * other.velocity.y
        const c3 = this.velocity.x - R * this.velocity.y
        const c4 = other.velocity.x - R * other.velocity.y
  
        const v1 = 0.5 * (c1 - R * c2 - M * c3 + c4)
        const v2 = 0.5 * (-iR * c1 + c2 + M * iR * c3 + iR * c4)
        const u1 = 0.5 * (iM * c1 + R * iM * c2 + c3 - iM * c4)
        const u2 = 0.5 * (iM * iR * c1 + iM * c2 - iR * c3 - iM * iR * c4)
  
        this.velocity = new Vector(v1, v2)
        other.velocity = new Vector(u1, u2)
      }
      else{
        const R = -vec.y / vec.x
        const iM = 1 / M
        const iR = 1 / R
  
        const c1 = this.velocity.y + M * other.velocity.y
        const c2 = this.velocity.x + M * other.velocity.x
        const c3 = this.velocity.y - R * this.velocity.x
        const c4 = other.velocity.y - R * other.velocity.x
  
        const v1 = 0.5 * (c1 - R * c2 - M * c3 + c4)
        const v2 = 0.5 * (-c1 + R * c2 + M * c3 + c4) * iR
        const u1 = 0.5 * (iM * c1 + R * iM * c2 + c3 - iM * c4)
        const u2 = 0.5 * (iM * c1 + iM * R * c2 - c3 - iM * c4) * iR
  
        this.velocity = new Vector(v1, v2)
        other.velocity = new Vector(u1, u2)
      }
      
    }
  }
  update() {
    this.bounce()
    this.velocity.y += gravity * this.mass()
    this.velocity = this.velocity.mult(drag)
    this.rotSpeed *= drag
    this.rot += this.rotSpeed
    this.pos = this.pos.add(this.velocity)
  }

  render() {
    //TODO: color
    // draw_circle(this.pos, this.radius)
    // const imgX = this.pos.x-this.radius
    // const imgY = this.pos.y-this.radius
    // ctx.save()
    // ctx.translate(imgX,imgY,canvas.width/this.radius*2,canvas.height/this.radius*2)
    // ctx.rotate(Math.PI)
    // ctx.drawImage(this.sprite,0,0)
    // ctx.restore()
    ctx.fillStyle = "rgb(200 0 0)";
    this.rot = this.rot || Math.PI*2*Math.random()
    draw_image(this.sprite,this.pos,this.radius*2,this.rot)
  }
}

function draw_image(img,pos,scale,rotation){
  ctx.save()
  ctx.translate(pos.x,pos.y)
  ctx.rotate(rotation);
  ctx.drawImage(img, -scale/2, -scale/2,scale,scale);
  ctx.restore()
}

function draw_circle(pos, radius) {
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function init() {
  ballSprite.src = "./ball_sprite.png"
  backgroundImage.src = "./bliss.jpg"
  for (let i = 0; i < 0; i++) {
    bubbles.push(new Bubble(new Vector(Math.random() * canvas.width, Math.random() * canvas.width), 30, new Vector(Math.random() * 100, 3)))
  }
}

function update(tFrame) {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  bubbles.forEach((b, i) => {
    b.update()
    bubbles.slice(i + 1).forEach((b2) => b.collide(b2))
  })
}
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffa3ff"
  ctx.fillRect(0,0, canvas.width, canvas.height)
  ctx.drawImage(backgroundImage,0,0,canvas.width,canvas.height)
  bubbles.forEach((b, i) => {
    bubbles.slice(i + 1).forEach((b2) => {
      const maxDistance = 400
      const distance = b.pos.sub(b2.pos).length()
      if (distance > 400)
        return
      ctx.beginPath()
      ctx.strokeStyle = `rgba(0, 0, 0, ${1 - distance / 400})`;
      ctx.moveTo(b.pos.x, b.pos.y)
      ctx.lineTo(b2.pos.x, b2.pos.y)
      ctx.stroke()
    })
  })

  bubbles.forEach((b) => {
    b.render()
  })

  if (startPos) {
    ctx.fillStyle = "blue"
    draw_circle(startPos, 25)
    ctx.beginPath()
    ctx.strokeStyle = `rgb(0 0 0)`;
    ctx.moveTo(startPos.x, startPos.y)
    let end = startPos.add(startPos.sub(mousePos))
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }
}
canvas.addEventListener("mousemove", (e) => {
  mousePos = new Vector(e.clientX, e.clientY)
})

canvas.addEventListener("mousedown", (e) => {
  startPos = mousePos.mult(1)
})
canvas.addEventListener("mouseup", (e) => {
  const newBub = new Bubble(startPos.mult(1), Math.random()*10+40, startPos.sub(mousePos).div(10))
  newBub.sprite.src = "./balls/"+Math.ceil(Math.random()*32)+".png"
  bubbles.push(newBub)
  startPos = null
})
  ; (() => {
    function main(tFrame) {
      window.requestAnimationFrame(main);

      update(tFrame);
      render();
    }

    main();
  })();


init()
