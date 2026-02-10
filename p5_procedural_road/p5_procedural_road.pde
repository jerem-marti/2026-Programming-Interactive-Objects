PGraphics led;


void setup() {
  size(500, 500);
  noSmooth();

  led = createGraphics(32, 32);
  led.noSmooth();
}

void draw() {

  led.beginDraw();
  led.background(0);

  
  
  int t = frameCount / 2;
  
  


  for (int i=0; i<led.height; i++) {

    int lineId = led.height - 1 - i;
    
    int streetWidth = 19;//floor(map(sin(float(lineId) / led.height * PI - t * 0.01), -1, 1, 12, 20)); 
    int cx = round(led.width / 2 + sin(float(lineId) /  led.height * PI / 2.0 + t * 0.05) * 5);

    led.stroke(255);

    // left
    led.point(cx - streetWidth/2, lineId);
    // right
    led.point(cx + streetWidth/2 - 1 , lineId);

    // center
    if ((lineId - t + led.height) / 6 % 2 == 0) {
      led.point(cx, lineId);
      //led.point(cx, lineId);
    }
  }


  led.endDraw();


  background(200);

  image(led, 10, 10, led.width * 12, led.height * 12);
}
