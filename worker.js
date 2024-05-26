onmessage = (evt) => {
	const canvas = evt.data.canvas;
	const ctx = canvas.getContext("2d");

	function render(time) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.font = "24px Verdana";
		ctx.textAlign = "center";
		ctx.fillText("AHOJ", canvas.width / 2, canvas.height / 2);
		requestAnimationFrame(render);
	}
	requestAnimationFrame(render);
};
