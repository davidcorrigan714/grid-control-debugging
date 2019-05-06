/// <reference types="vss-web-extension-sdk" />
import Controls = require("VSS/Controls");
import Grids = require("VSS/Controls/Grids");

var container = $(".sample-container");

var gridItems: Grids.IGridHierarchyItem[] = [
  { id: "001", name: "Baking" },
  {
    id: "002", name: "Beverages", children: [
      { id: "003", name: "Coffee" },
      {
        id: "004", name: "Tea", collapsed: true, children: [
          { id: "005", name: "Green Tea" },
          { id: "006", name: "Black Tea" },
          { id: "007", name: "Herbal Tea" },
          { id: "008", name: "Fruit Tea" },
          { id: "009", name: "Decaffeinated" }
        ]
      },
      { id: "010", name: "Water" },
      { id: "011", name: "Hot Cocoa" },
      {
        id: "012", name: "Sports & Energy Drinks", children: [
          { id: "013", name: "Liquids" },
          { id: "014", name: "Energy" },
          { id: "015", name: "Specialty" },
          { id: "016", name: "Other" }
        ]
      },
      { id: "017", name: "Soft Drinks" }
    ]
  },
  { id: "018", name: "Frozen Foods" },
  { id: "019", name: "Candy" }
];

var gridOptions: Grids.IGridOptions = {
  height: "600px",
  width: "450px",
  columns: [
    { text: "Id", index: "id", width: 60 },
    { text: "Product Name", index: "name", width: 200, indent: true }
  ]
};

var grid = Controls.create<Grids.Grid, Grids.IGridOptions>(Grids.Grid, container, gridOptions);
var gridSource = new Grids.GridHierarchySource(gridItems);

grid.setDataSource(gridSource);
console.log(VSS.getExtensionContext().version);

VSS.notifyLoadSucceeded();