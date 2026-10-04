/* Install explicit method owners before registering the custom element.
 * Methods keep their panel receiver and class-style descriptors. Fail on a
 * duplicate owner rather than silently replacing an editor interaction. */
export function installPanelMethods(prototype, owners) {
  const pending = new Map();
  for (const [owner, methods] of Object.entries(owners)) {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
      if (name in prototype || pending.has(name)) {
        throw new Error(`Duplicate panel method ${name} in ${owner}`);
      }
      pending.set(name, { ...descriptor, enumerable: false });
    }
  }
  Object.defineProperties(prototype, Object.fromEntries(pending));
}
