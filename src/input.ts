import { Vector } from "./lib";

export interface GameInputCallbacks {
    onPointerDown: (pos: Vector) => void;
    onPointerUp: (pos: Vector) => void;
    onPointerMove: (pos: Vector) => void;
    onPinch: (direction: "in" | "out") => void;
    onScroll: (deltaY: number) => void;
    onResize: () => void;
}

export class InputManager {
    private canvas: HTMLCanvasElement;
    private callbacks: GameInputCallbacks;
    private evCache: PointerEvent[] = [];
    private previousEvDistance = -1;

    constructor(canvas: HTMLCanvasElement, callbacks: GameInputCallbacks) {
        this.canvas = canvas;
        this.callbacks = callbacks;

        window.addEventListener("resize", this.callbacks.onResize);
        document.addEventListener("pointerdown", this.handlePointerDown.bind(this));
        document.addEventListener("pointerup", this.handlePointerUp.bind(this));
        document.addEventListener("pointermove", this.handlePointerMove.bind(this));
        document.addEventListener("wheel", this.handleWheel.bind(this));
    }

    private removeEvent(ev: PointerEvent) {
        // Remove this event from the target's cache
        const index = this.evCache.findIndex(
            (cachedEv) => cachedEv.pointerId === ev.pointerId,
        );
        this.evCache.splice(index, 1);
    }

    private convertEventPos(event: PointerEvent): Vector {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return new Vector(
            (event.clientX - rect.left) * scaleX,
            (event.clientY - rect.top) * scaleY,
        );
    }
    private handlePointerMove(e: PointerEvent) {
        const pos = this.convertEventPos(e)
        this.callbacks.onPointerMove(pos)

        const index = this.evCache.findIndex(
            (cachedE) => cachedE.pointerId === e.pointerId,
        );
        this.evCache[index] = e;
        if (this.evCache.length === 2) {
            const firstTouch = new Vector(this.evCache[0].clientX, this.evCache[0].clientY);
            const secondTouch = new Vector(this.evCache[1].clientX, this.evCache[1].clientY);
            const diff = firstTouch.sub(secondTouch).length();
            const neededDistance = 13;
            if (this.previousEvDistance > 0) {
                if (diff > this.previousEvDistance + neededDistance) {
                    this.callbacks.onPinch("in")
                }

                if (diff < this.previousEvDistance - neededDistance) {
                    this.callbacks.onPinch("out")
                }
            }
            this.previousEvDistance = diff;
        }
    }
    private handlePointerDown(e: PointerEvent) {
        const pos = this.convertEventPos(e)
        this.callbacks.onPointerDown(pos)

        this.evCache.push(e);
        // if (this.evCache.length === 2) {
        //     this.startingTouchCenter = convertEventPos(evCache[0]).add(
        //         convertEventPos(evCache[1]).sub(convertEventPos(evCache[0])).div(2),
        //     );
        // }
    }

    private handlePointerUp(e: PointerEvent) {
        const pos = this.convertEventPos(e)
        this.callbacks.onPointerUp(pos)
        this.removeEvent(e);
        if (this.evCache.length < 2) {
            this.previousEvDistance = -1;
        }

    }
    private handleWheel(e: WheelEvent) {
        this.callbacks.onScroll(e.deltaY);
    }

}

