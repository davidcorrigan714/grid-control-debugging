/// <reference types="vss-web-extension-sdk" />
import * as Controls from "VSS/Controls";
import * as Grids from "VSS/Controls/Grids";
import * as WIT from "TFS/WorkItemTracking/RestClient";
import * as Contracts from "TFS/WorkItemTracking/Contracts";
import * as lunr from "lunr";
//import * as PS from "ProductSelector";
import {allProducts, getRootNode} from "./productshub";

/*
interface AreaPathsI extends Contracts.WorkItemClassificationNode{
    products : Array<PS.productEntryI>;
}*/

var grid : Grids.Grid;
var idx : lunr.Index;
//var areas : AreaPathsI;

function resultsSort(a : lunr.Index.Result , b : lunr.Index.Result) : number
{
    if (a.score == b.score){
        // Using the ref index coorelates it to firstAvailable to some extent
        if(a.ref > b.ref){
            return 1;
        }else{
            return -1
        }
    }else if(a.score > b.score){
        return -1;
    }else{
        return 1;
    }
}

async function LoadAreaPaths() {
  // Get all the area paths
  var WebContext = VSS.getWebContext();
  var WITClient = WIT.getClient();
  var rootNodes : Contracts.WorkItemClassificationNode[] = [];
  var nodes : Contracts.WorkItemClassificationNode[] = [];

  await WITClient.getRootNodes(WebContext.project.name).then(function (retNodes : Contracts.WorkItemClassificationNode[]){
    rootNodes = retNodes;
  });

  await WITClient.getClassificationNodes(WebContext.project.name, [rootNodes[0].id],50).then(function (retNodes : Contracts.WorkItemClassificationNode[]){
    nodes = retNodes;
  });

  grid.setDataSource(new Grids.GridHierarchySource([nodes[0]]));
  grid.collapseAll();
  grid.expandByLevel(1);
}

var gridOptions : Grids.IGridOptions = {
    allowTextSelection: true,
    height: "100%",
    width: "100%",
    allowMultiSelect: false,
    columns: [
      { text: "Area", width: 300, index: "name" },
      { text: "Valid Products", index: "products" },
    ]
  };

grid = Controls.create(Grids.Grid, $("#areaTree"), gridOptions);

export function refreshAreaIndex(){
    // Remove the stop word filter from the indexing process.
    // Otherwise you can't search for 'CAN' devices.
    // Looking at the lunr code and filtered words it doesn't seem to be necessary for our dataset of product names
    // @ts-ignore Best way I could find to do this without touching the lunr source
    lunr.stopWordFilter =  lunr.generateStopWordFilter([]);
    lunr.Pipeline.registerFunction(lunr.stopWordFilter, 'stopWordFilter')

    idx = lunr(function(builder) {
        this.ref('gridKey');
        this.field('name');
        for (var i in allProducts) {
          this.add(allProducts[i]);
        }
      });
    $("#productAreaEditorModal").modal();
}

$("#searchQuery").on('input',function (){
  $("#products").empty();
  $("#products2").empty();

  if($(this).val() == ''){
      //addAllProductsToSearchPage(); TODO
  }else{
      var results : Array<lunr.Index.Result> = idx.search($(this).val());
      results.sort(resultsSort);

      var length = results.length;
      if(length > 100){
          length = 100;
      }

      var usedKeys :Array<string> = [];

      for(var i = 0;i<length;i++){
          var rootNode = getRootNode(parseInt(results[i].ref));
          if(rootNode){
            if(usedKeys.indexOf(rootNode.key) < 0){
                usedKeys.push(rootNode.key);
                $("#products").append("<option value=\"" + rootNode.gridKey + "\">" + rootNode.name + "</option>");
            }
          }
      }

      if(length > 0){
          $("#products").val($("#products option:first").val()).change();
      }
  }
});

$("#products").on('change', function(){

});

$("#areaProductAdd").on("click", function (){
    var productNode = getRootNode(parseInt($("#products").val()));
    if(productNode)
    {
        if(productNode.active == true){
            $("#products2").append("<option value='" +
                JSON.stringify({name: productNode.name, key: productNode.key})
                + "'>" + productNode.name + "</option>");
        }
    }
});

$("#areaProductRemove").on("click", function (){
    $("#products3 option:selected").remove();
});

VSS.ready(LoadAreaPaths);
