# Dramatoric DSL registries

Generated from the engine's own tables by `talky spec` — do not edit by hand.
Each list is complete for its fixed vocabulary. Extensible names, such as authored
action verbs and story emotions, are called out below. `talky lint <cart-dir>`
checks these rules. See games/golden/golden.drama for usage.

## Expression functions

Every name a formula may call, with what it takes and what it answers — the world's own vocabulary and the language's arithmetic, checked against these signatures when the cartridge loads. Operators are CEL's: `+ - * / % == != < <= > >= && || ! ?:`, with member access, indexing, list and map literals. Square brackets mark optional arguments.

`abs(number) -> number`, `actors() -> list`, `ceil(number) -> number`, `chance(number) -> bool`, `clamp(number, number, number) -> number`, `dice(number) -> number`, `distance(string, string) -> number`, `emotion(string, string) -> number`, `floor(number) -> number`, `free_anchor(string) -> string`, `heardFrom(string, string, [string]) -> bool`, `hearsay(string) -> number`, `held(string, string) -> bool`, `humanoid(string) -> map`, `idle(string) -> number`, `in_zone(string, string) -> bool`, `knows(string, string) -> bool`, `max(number, …) -> number`, `min(number, …) -> number`, `pick(list) -> dyn`, `player() -> string`, `quietest([string]) -> string`, `rand() -> number`, `randint(number, number) -> number`, `roll(number, number) -> number`, `round(number) -> number`, `rumors() -> list`, `silence() -> number`, `size(list) -> number`, `state(string, string) -> dyn`, `teller(string, string) -> string`, `visible(string, string) -> bool`

## Formula scopes

Which names a formula may read depends on where it is written. A name outside its scope is a load error.

`action: actor, object, target`, `listener: actor, cause`, `observation: actor, object, observer, target`, `face: actor, player`, `desc: looker, self`, `prompt: self`, `hud: nothing`, `canvas: actor, player`, `control: actor, object, target, value`

## World effect verbs

Inside an Action block, `World <verb> ...` writes stagecraft globals.

`camera`, `camera_follow`, `control`, `cue`, `creator`, `add`, `remove`, `enter`

## Entity effect verbs

Also `emotion.<name>` (any emotion name, value 0..1, plus optional duration seconds), `humanoid.<sub>` with sub one of `species`, `seed`, `gene`, `voice`, `skin`, `blink`, `appearance`, `structure`, `hair`, `outfit`, `render`, and `light.<sub>` with sub one of `intensity`, `range`, `color`. `state.<name>` writes a scalar; `text.<name>` writes string state without coercion. Use an action role or literal entity as the subject: `Target watch = actor`, `Actor gesture nod`, `Target emotion.surprised 0.8 12s`, or `lamp hidden true`. Timed emotions stack and cool to zero; an emotion without a duration is durable. Cue directions use the same verbs.

`turn`, `name`, `desc`, `persona`, `controller`, `seek`, `support`, `watch`, `business`, `duet`, `hidden`, `perceivable`, `mouth`, `pose`, `doing`, `gesture`, `hear`, `place`, `attach`, `detach`, `humanoid`, `pos`, `shift`, `rot`, `commitment`

## Event verbs for `Action on` listeners

A listener also matches any authored `Action verb`; `Action on "*"` matches every event. Verbs not listed under perceivable events here are internal stagecraft.

`Camera`, `Camera Follow`, `Cinematic`, `Control`, `Cue`, `Data Requested`, `Data Resolved`, `Despawn`, `Dialogue End`, `Direct`, `Duet`, `Enter`, `Exit`, `Handoff`, `Inside`, `Know`, `Mount`, `Move`, `Persona Defined`, `Pulse`, `Say`, `Shot`, `Spawn`, `Speech End`, `State`, `Thought`, `Turn`, `Visual Effect`

## Built-in social reactions

Default reactions every minded character carries: `attend` faces whoever addresses it, `reply` answers another character who does (the player's addressed line already draws a direct response), `chime` occasionally joins an addressed exchange nearby, and `stir` breaks a long silence — `stir` listens to the pulse, so it spends nothing unless the cartridge sets one (`Game pulse 10`). An authored action with the same id shadows the default; `when false` silences it.

`attend`, `reply`, `chime`, `stir`

## Held motions

Motions that persist until replaced. `pose` sets the stance (seated, lying); `doing` layers one over it (on the phone), so the same activity reads whether the character is sitting or standing. Both take any id below.

`fetal`, `floor_sit`, `lying`, `phone_call`, `phone_scroll`, `phone_stare`, `seated`

## Gestures

Timed one-shot animations for `gesture` directions and effects.

`air_quotes`, `apologize`, `applaud`, `beckon`, `blow_kiss`, `bow`, `call_out`, `celebrate`, `check_watch`, `cock`, `concede`, `cough`, `counting`, `cover_mouth`, `dismiss`, `double_take`, `drink`, `dukes`, `embrace`, `explain`, `facepalm`, `fear_mouth`, `finger_wag`, `fist_bump_offer`, `hand_over_heart`, `hands_on_head`, `handshake_offer`, `high_five_offer`, `hug`, `hush`, `kiss_accept`, `kiss_lean`, `laugh`, `nervous_fidget`, `nod`, `oath`, `palm_up_question`, `pinch_bridge_nose`, `plead`, `point`, `ponder`, `prayer`, `present`, `raise_hand`, `reassure`, `receive`, `recoil`, `rub_hands`, `salute`, `shake`, `shiver`, `shock_cheeks`, `shock_mouth`, `shrug`, `sigh`, `slap`, `sneeze`, `stop`, `surrender`, `tear_hair_out`, `throw_hands_up`, `thumbs_down`, `thumbs_up`, `wave`, `weep`, `whisper`, `whisper_in_ear`, `whisper_listen`, `wipe_brow`, `wipe_tears`, `yawn`

## Face emotions

Emotion names that drive the rendered face. Other emotion names are still valid story state for HUDs and conditions; they just have no facial pose.

`happy`, `sad`, `angry`, `fearful`, `surprised`, `disgusted`, `confused`, `romantic`, `bored`, `tired`, `suspicious`, `devious`, `embarrassed`, `worried`

## Standard effects

Effect macros the runtime always carries, named by `use("<id>", {...})` inside an effect source. Every parameter is required and may be any expression, including another effect. A cartridge shadows one by declaring `Game effects.<id>` itself.

`burst(count, over, life, seed, effect)`, `fade(from, to)`, `line(from, to, width, color, opacity, blend)`, `move(position, effect)`, `point(size, color, opacity, blend)`, `pulse(low, high, speed)`

## Geometry kinds

The kind segment in a dotted `geometry.<kind>.<field>` declaration. A kind's own name is also a path of its own, so `box [w, h, d]` means `geometry.box` with the dimensions below filled in order.

`box`, `cylinder`, `extrude`, `lathe`, `mesh`, `plane`, `sphere`, `sprite`

## Geometry vectors

The dimensions a vector fills, in order. Kinds built from lists of points have no vector form. `camera` takes one too.

`box: width, height, depth`, `cylinder: radius, height, sides`, `plane: width, height`, `sphere: radius, segments, rings`, `sprite: width, height`, `camera: fov, near, far`
