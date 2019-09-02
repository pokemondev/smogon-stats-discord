export function getMapValues<T>(map: any): T[] {
  return Object.keys(map).map(k => map[k]);
}

export function groupBy<T>(xs: T[], key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};