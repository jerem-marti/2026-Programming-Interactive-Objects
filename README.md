# 1024 (~One Thousand) Pixels
SUPSI MAInD  
Programming interctive objects  
Workshop 9–13.2.2025

## Project Brief
The aim of the workshop is to embrace constraints and develop ideas around the limitations of a low-resolution display. Limitations as (design-) opportunities rather than obstacles.


## Objectives 
The assignment is open-ended. Students are invited to approach the project from the ground up: instead of focusing on an initial idea for the output or final result, the attention should be on the process of exploration and discovery.

Explore three different ways to apporach the brief: 
- technical approach
- contextual approach 
- conceptpual approach 


## Expected outcome, deliveries 
On the final day, all projects will be presented to the class. The delivery must include:
- a working prototype of the matrix 
- a brief presentation describing its context of use (renderings, scale, contexte, etc.)
The presentation may also include selected parts of the research and development process, if they help clarify the concept, decisions, or learning outcomes.  


## Topics
- Idea driven development and research 
- Realtime graphics and animation concepts 
- Serial communication 
- Wireless communication
- Quick prototyping 
- LED matrices 

## Part list
- RGB LED matrix 32×32 P6 (P6 means that the LED pitch is 6mm)
- PicoDriver, custom ESP32 controller
- USB-C cable (data and power)
- 5V power cable for the LED matrix (usually comes with the matrix)

Aleternative to the custom PicoDriver:  
- [Teensy 4.0 or 4.1 development board](https://www.pjrc.com/teensy/) (a Teensy 3.2 will do but has limited memory and processor speed)
- [SmartLed shield](https://docs.pixelmatix.com/SmartMatrix/) (not strictly necessary but handy to quickly connect the microcontroller)
- Micro-USB cable for Teensy programming
- 5V power supply (3A minimum), plus cables

## Software requirements
- [VS Code](https://code.visualstudio.com/download)
- [Platformio for VS Code](https://platformio.org) (install as VS Code plugin)
- [GitHub Desktop](https://desktop.github.com) (not mandatory, but handy)

## Hooks
Physical: 
- 32×32 (1024) pixels 
- 192×192 mm (32×P6=192)
- Square display (uncommon!)
- Unadorned, tileable 
- 1024×3 = 3072 bytes of memory per image

Content: 
- The pixel is the main subject!
- LEDs emit strong light: can be considered as light source, reflective, blurred, etc. 
- Phyiscal object, can be placed or manipulated

Pixel based algorithms: 
- [Dithering](https://en.wikipedia.org/wiki/Dither) (Bayer, Floyd-Steinberg, error diffusion, etc.)
- [Pixel Sorting](https://github.com/DavidMcLaughlin208/PixelSorting)
- [“Sand” games](https://neal.fun/sandboxels/)
- [Doom Flame](https://www.youtube.com/watch?v=B7iacc3HiVE)
- [Cellular automatas](https://conwaylife.com)
- [XOR patterns](https://hackaday.com/2021/04/13/alien-art-drawn-with-surprisingly-simple-math/)
- [Flood Fill](https://en.wikipedia.org/wiki/Flood_fill)

Pixel based content/media: 
- [Pixel grapics/icons](https://www.pngkey.com/detail/u2q8o0w7q8a9i1r5_bosses-zelda-enemy-sprite-sheet/)
- [Bitmap fonts](https://int10h.org/oldschool-pc-fonts/download/)
- Dithering and tile-based patterns of [MacPaint](https://en.wikipedia.org/wiki/MacPaint)


## Workshop organization

### Day 1  
- “1024 pixels“ assignment and start of the week  
- Introduction to LED matrices  
- Introduction to the ESP32 microcontroller
- Software setup (VS Code, GitHub, etc.)
- Introdcution/recap to Arduino 
- Introduction to realtime graphics and graphics APIs

### Day 2
- Introduction to serial ports, serial communication, Wifi
- Personal reserach, prototyping, project development 
- Daily feedback and project discussion  

### Day 3
- Code exercises, theory
- Personal reserach, prototyping, project development 
- Daily feedback and project discussion  
- Guest: Raven Kwok (16h), [X](https://x.com/RavenKwok), [Instagram](https://www.instagram.com/_ravenkwok/)


### Day 4
- Code exercises, theory
- Personal reserach, prototyping, project development 
- Daily feedback and project discussion

### Day 5
- Presentation 
- Documentation 

# Prepare for the daily project critique
- Try a direction with focus on each of these approaches:  
the phyiscial LED matrix, a possible context, LEDs as light source(s),
- Bring something interesting, a little discovery – not an idea for a finished project; let the process guide you
- Show hand drawings and sketches, low-quality screenshots or videos, a little demo, an animation  
- No mood-boards! No projects of others that involve LED matrices! Do (deep) research instead on the boader topic(s). 

# Process
The design process is iterative by nature, continuous feedback and refinement are fundamental for a good outcome. Don’t vibe-code the process away. 

## Sources
- [Design Q&A with Charles and Ray Eames](https://www.hermanmiller.com/stories/why-magazine/design-q-and-a-charles-and-ray-eames/)
- [AONDEMO - a demo for an old telephone](https://www.youtube.com/watch?v=GPG6a__Q0Sg)
- [Inigo Quilez: 2D distance functions](https://iquilezles.org/articles/distfunctions2d/)
- [Inigo Quilez: 23 distance functions](https://iquilezles.org/articles/distfunctions/)
- [Inigo Quilez: [Painting a Landscape with Mathematics](https://www.youtube.com/watch?v=BFld4EBO2RE&t=2268s)
