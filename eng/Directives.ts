import { BLOCK_directive, INCLUDE_directive, RUN_directive, TEMPLATE_directive } from "./directives/BlockRunDirectives";
import { CAPTURE_directive } from "./directives/CaptureDirective";
import { CASE_directive } from "./directives/CaseDirective";
import { CODE_directive } from "./directives/CodeDirective";
import { DATA_directive } from "./directives/DataDirective";
import { fallthru_directive, noop_directive } from "./directives/DefaultDirectives";
import { DONE_directive } from "./directives/DoneDirective";
import { EACH_directive } from "./directives/EachMapDirective";
import { EMIT_directive } from "./directives/EmitDirective";
import { ENTITY_directive } from "./directives/EntityDirective";
import { EXIT_directive } from "./directives/ExitDirective";
import { FETCH_directive } from "./directives/FetchDirective";
import { GOTO_directive, SCENE_directive } from "./directives/GotoDirective";
import { IF_directive } from "./directives/IfElseWhenOnOnceDirective";
import { LLM_directive } from "./directives/LlmDirective";
import { LOG_directive } from "./directives/LogDirective";
import { MUSIC_or_SOUND_directive } from "./directives/MusicSoundDirectives";
import { PARALLEL_directive } from "./directives/ParallelDirective";
import { PRELUDE_directive } from "./directives/PreludeResumeEpilogueDirective";
import { RENDER_directive } from "./directives/RenderDirective";
import { ROOT_directive } from "./directives/RootGroupDirective";
import { LOAD_directive, SAVE_directive } from "./directives/SaveLoadDirectives";
import {
  ACT_directive,
  CUE_directive,
  SAY_directive,
  SIMULATE_directive,
  STATE_directive,
  WITH_directive,
} from "./directives/SimulationDirectives";
import { SET_directive } from "./directives/SetDirective";
import { SUSPEND_directive } from "./directives/SuspendDirective";
import { TEXT_directive } from "./directives/TextDirective";
import { VAR_directive } from "./directives/VarDirective";
import { VARY_directive } from "./directives/VaryDirective";
import { WAIT_directive } from "./directives/WaitDirective";
import { BREAK_directive, WHILE_directive } from "./directives/WhileBreakDirective";
import { StoryDirectiveFuncDef } from "./Helpers";

export const DIRECTIVES: StoryDirectiveFuncDef[] = [];

DIRECTIVES.push(ROOT_directive);
DIRECTIVES.push(BLOCK_directive);
DIRECTIVES.push(TEMPLATE_directive);
DIRECTIVES.push(BREAK_directive);
DIRECTIVES.push(CAPTURE_directive);
DIRECTIVES.push(SUSPEND_directive);
DIRECTIVES.push(CASE_directive);
DIRECTIVES.push(CODE_directive);
DIRECTIVES.push(DATA_directive);
DIRECTIVES.push(DONE_directive);
DIRECTIVES.push(EACH_directive);
DIRECTIVES.push(EXIT_directive);
DIRECTIVES.push(EMIT_directive);
DIRECTIVES.push(ENTITY_directive);
DIRECTIVES.push(SIMULATE_directive);
DIRECTIVES.push(CUE_directive);
DIRECTIVES.push(WITH_directive);
DIRECTIVES.push(STATE_directive);
DIRECTIVES.push(SAY_directive);
DIRECTIVES.push(ACT_directive);
DIRECTIVES.push(FETCH_directive);
DIRECTIVES.push(GOTO_directive);
DIRECTIVES.push(SCENE_directive);
DIRECTIVES.push(IF_directive);
DIRECTIVES.push(PRELUDE_directive);
DIRECTIVES.push(LLM_directive);
DIRECTIVES.push(LOG_directive);
DIRECTIVES.push(MUSIC_or_SOUND_directive);
DIRECTIVES.push(PARALLEL_directive);
DIRECTIVES.push(RENDER_directive);
DIRECTIVES.push(RUN_directive);
DIRECTIVES.push(INCLUDE_directive);
DIRECTIVES.push(SAVE_directive);
DIRECTIVES.push(LOAD_directive);
DIRECTIVES.push(SET_directive);
DIRECTIVES.push(TEXT_directive);
DIRECTIVES.push(VAR_directive);
DIRECTIVES.push(VARY_directive);
DIRECTIVES.push(WAIT_directive);
DIRECTIVES.push(WHILE_directive);
DIRECTIVES.push(noop_directive);

// Fallthrough action *must* be last (empty type array matches anything not already matched)
DIRECTIVES.push(fallthru_directive);
