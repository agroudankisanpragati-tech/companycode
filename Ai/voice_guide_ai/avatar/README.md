# Kisan Saathi — Avatar Runtime System

Semi-realistic Indian male avatar for the Pragati AI Voice Guide.

## Avatar Details

| Property       | Value                    |
|----------------|--------------------------|
| Name           | Kisan Saathi (किसान साथी) |
| Gender         | Male                     |
| Age Appearance | 27                       |
| Profession     | Agriculture Expert       |
| Style          | Semi-Realistic, Indian   |
| Background     | Transparent              |
| Frame          | Face and Shoulders       |

## Directory Structure

```
avatar/
├── runtime/              # Python runtime system (12 modules)
│   ├── avatar_controller.py   # Public entry point
│   ├── avatar_manager.py      # High-level coordinator
│   ├── avatar_loader.py       # Lazy initialisation
│   ├── avatar_state.py        # State machine (10 states)
│   ├── avatar_cache.py        # LRU asset cache
│   ├── asset_manager.py       # Asset loading & resolution
│   ├── animation_manager.py   # Frame sequencing & playback
│   ├── expression_manager.py  # Expression transitions
│   ├── lip_sync_manager.py    # Mouth shapes, blink, head movement
│   ├── position_manager.py    # 9 screen positions
│   ├── theme_manager.py       # 4 themes
│   └── event_manager.py       # Typed event bus (10 event types)
├── config/               # JSON configuration
│   ├── avatar.json
│   ├── expressions.json  # 13 expressions
│   ├── animations.json   # 13 animations
│   ├── positions.json    # 9 positions
│   ├── themes.json       # 4 themes
│   └── lip_sync.json
├── metadata/             # Asset index and version info
├── expressions/          # Expression image assets (13 folders)
├── animations/           # Animation frame assets (13 folders)
├── final/                # Optimised production assets
├── icons/                # Platform icons
└── thumbnails/           # Preview thumbnails
```

## Quick Start

```python
from avatar.runtime.avatar_controller import AvatarController

controller = AvatarController()
controller.initialise()
controller.show()

# Dialogue integration
controller.on_dialogue_play("home", "welcome")   # → namaste animation
controller.on_speaking_start()                    # → speaking + lip sync
controller.on_speaking_stop()                     # → idle
controller.on_listening_start()                   # → listening
controller.on_thinking_start()                    # → thinking

# Direct control
controller.set_expression("happy")
controller.play_animation("wave")
controller.set_theme("dark")
controller.set_position("bottom_right", viewport="mobile")

# Events
from avatar.runtime.event_manager import AvatarEventType
controller.on_event(AvatarEventType.EXPRESSION_CHANGED, lambda e: print(e.to_dict()))
```

## Expressions (13)
neutral · smile · happy · thinking · listening · speaking · warning · error · success · goodbye · confused · blink · loading

## Animations (13)
idle · wave · namaste · thinking · listening · speaking · success · warning · error · loading · goodbye · head_nod · head_shake

## Positions (9)
top_left · top_right · bottom_left · bottom_right · center_left · center_right · floating · dynamic · safe_area

## Themes (4)
light · dark · high_contrast · transparent
