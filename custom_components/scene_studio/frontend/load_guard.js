/** Pure route/request guard shared by panel loads and frontend tests. */

export function panelLoadIsCurrent(token, current) {
  return (
    token.generation === current.generation &&
    token.view === current.view &&
    token.sceneId === current.sceneId
  );
}
