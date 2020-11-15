export function getMapValues<T>(map: any): T[] {
  return Object.keys(map).map(k => map[k]);
}

export function getMap<T>(sourceObj: any): Map<string, T> {
  var map = new Map<string, T>();
  Object.keys(sourceObj).forEach(key => map.set(key, sourceObj[key]));
  return map;
}

export function groupBy<T>(xs: T[], key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export function areEquals(obj1: any, obj2: any): boolean {
  for (const field of Object.keys(obj1)) {
    const areEquals = obj1[field] === obj2[field];
    if (!areEquals)
      return false;
  }
  return true;
}