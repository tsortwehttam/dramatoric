import { readBody } from "../Execution";
import { MUSIC_TYPE, SOUND_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## MUSIC / SOUND
 *
 * **Summary**
 * Describe non-dialog audio like ambience, cues, or background music.
 *
 * **Syntax**
 * ```dramatoric
 * SOUND:
 * Audio description here.
 *
 * MUSIC: duration 5000; loop true
 * Audio description here.
 * ```
 *
 * **Examples**
 * ```dramatoric
 * SOUND:
 * The sound of birds chirping near a babbling brook
 * ```
 *
 * ```dramatoric
 * MUSIC: duration 5000
 * Rock music with medieval overtones
 * ```
 *
 * ```dramatoric
 * SOUND: loop true; volume 0.25
 * Gentle waves rolling under the docks
 * ```
 *
 * **Notes**
 * - The body is a natural-language description of the audio.
 * - Parameters like `duration`, `loop`, and `volume` customize playback.
 */

export const MUSIC_or_SOUND_directive: StoryDirectiveFuncDef = {
  type: [MUSIC_TYPE, SOUND_TYPE, "AUDIO"],
  func: async (node, ctx, pms) => {
    const text = await readBody(node, ctx);
    ctx.play(node.type === MUSIC_TYPE ? "music" : "sound", text, pms.pairs);
  },
};
