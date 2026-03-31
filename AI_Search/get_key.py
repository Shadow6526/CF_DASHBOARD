from pynput import keyboard

def on_press(key):
    print(f"\n--- KEY PRESSED ---: {repr(key)}")
    if hasattr(key, 'vk'): print(f"  VK (Virtual Key): {key.vk}")

def on_release(key):
    if key == keyboard.Key.esc:
        print("\nExiting...")
        return False

print("\n!!! PLEASE PRESS YOUR COPILOT BUTTON NOW !!!")
print("Press ESC when you are done.")
with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
    listener.join()
