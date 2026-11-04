import { Screen } from "@rallix/ui";
import { OfflineScore } from "./OfflineScore";

/** A shell with no data in it. The scorer's phone fills it from what it saved, so it opens with no signal. */
export default function ScoreOffline() {
  return <Screen className="rx-darkscreen"><OfflineScore /></Screen>;
}
