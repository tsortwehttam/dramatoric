import { inspect } from "util";

export function tap<T>(arg: T): T {
  console.info(inspect(arg, false, null, true));
  return arg;
}
