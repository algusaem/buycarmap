# List of tasks pending for development

- Map needs more functionalities (show the items on the map and let navigate, filter by zoom, etc.)
- Map: `FitBounds` refits on every change to the listings array, so loading the
  next page of infinite scroll yanks the map away from wherever the user panned
  (`components/map/ListingsMap.tsx`). Independent of the feature work above.
