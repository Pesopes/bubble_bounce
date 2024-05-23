class Vector {
    x;
    y;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    
    squared(){
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
        return new Vector(this.x,this.y)
      }
    }
  
    div(a) {
      if (a instanceof Vector) {
        return new Vector(this.x / a.x, this.y / a.y)
      } else {
        return new Vector(this.x / a, this.y / a)
      }
    }
    mult(a) {
      if (a instanceof Vector) {
        return new Vector(this.x * a.x, this.y * a.y)
      } else {
        return new Vector(this.x * a, this.y * a)
      }
    }
  
    add(a) {
      if (a instanceof Vector) {
        return new Vector(this.x + a.x, this.y + a.y)
  
      } else {
        return new Vector(this.x + a, this.y + a)
      }
    }
  
    sub(a) {
      if (a instanceof Vector) {
        return new Vector(this.x - a.x, this.y - a.y)
      } else {
        return new Vector(this.x - a, this.y - a)
      }
    }
  
    negate() {
      return new Vector(-this.x, -this.y)
    }
    
    dot(a){
        return this.x*a.x+this.y*a.y
    }

    static lerp(a, b, t) {
      return a.add(b.sub(a).mult(t))
    }
  }