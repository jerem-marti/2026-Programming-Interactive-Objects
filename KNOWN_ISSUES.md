# Known Issues

## 1. USB driver on Windows
Some Windows machines may need an extra serial port driver.

#### Solution
Try to install this USB driver [CP210x USB to UART Bridge](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers?tab=downloads)  


## 2. Connection error on macOS (probably on Sonoma and newer)
If you encounter the error
```
Connecting........_____....._____....._____....._____

A fatal error occurred: Failed to connect to ESP32: Timed out waiting for packet header
*** [upload] Error 2
=============== [FAILED] Took 30.98 seconds ===============
```
there may be a connection issue between your Mac and the ESP32 board.

#### Solution
1. Open the `z1_connection_issue` folder in Visual Studio Code and wait until PlatformIO finishes setting up.
2. Open the PlatformIO terminal by clicking the icon in the status bar.  
   If you're unsure where it is, refer to this image:  
![PlatformIO terminal](zz_resources/platformio-terminal.png?raw=true);
3. Run the following command in the terminal:  
```python3 connection_fix.py```
4. If the terminal prints:
```Updated /Users/name/.platformio/platforms/espressif32@3.5.0/builder/main.py successfully```