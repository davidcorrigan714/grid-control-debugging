import Controls = require("VSS/Controls");
import Grids = require("VSS/Controls/Grids");

// Just a scratch file to use VSCode's autocomplete in a ts file

var container = $(".sample-container");

var source = [
  { name: "Germany", population: 8e7 },
  { name: "Turkey", population: 75e6 },
  { name: "Russia", population: 15e7 },
  { name: "Spain", population: 45e6 }
];

var gridOptions: Grids.IGridOptions = {
  height: "300px",
  width: "500px",
  source: source,
  columns: [
    { text: "Country", width: 200, index: "name" },
    { text: "Population", width: 200, index: "population" }
  ]
};

var grid = Controls.create(Grids.Grid, container, gridOptions);

// Update source 5 seconds later
window.setTimeout(() => {
  source.push({ name: "Belgium", population: 1e7 });
  source.push({ name: "France", population: 64e6 });
  grid.setDataSource(source);

}, 5000);