/// <reference types="vss-web-extension-sdk" />
import * as Controls from "VSS/Controls";
import * as Grids from "VSS/Controls/Grids";
import * as WIT from "TFS/WorkItemTracking/RestClient";
import * as Contracts from "TFS/WorkItemTracking/Contracts";
import * as lunr from "lunr";
//import * as PS from "ProductSelector";
import {getRootNode, getDoc, setDoc, docI} from "./productshub";

export interface AreaQueriesI {
    id: number;
    query: string;
}

interface AreasAndQueriesI{
    query: string;
    name: string;
    id: number;
    children: AreasAndQueriesI[];
}

var areaQueries : AreaQueriesI[] = [];
var projectAreas : Contracts.WorkItemClassificationNode;
var areasAndProducts : AreasAndQueriesI[] = [];
var selectedArea : AreaQueriesI | undefined;

var grid : Grids.Grid;
var idx : lunr.Index;

$("#queryText").on("input", function(){
    if(selectedArea != undefined){
        selectedArea.query = $(this).val();
        grid.redraw();
    }
});

$("#areaTree").on("click", function(){
    selectedArea = undefined;

    var selected = grid.getSelectedDataIndices();

    if(selected.length == 0){
      return;
    }

    selectedArea = grid.getRowData(selected[0]);
    if(selectedArea != undefined){
        $("#queryText").val(selectedArea.query);
    }
});

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

function refreshGridFromData() : void
{
    grid.setDataSource(new Grids.GridHierarchySource(areasAndProducts));
}

// Walk the area tree and merge it with the associated products for the grid
function loadProductsToAreas(node : Contracts.WorkItemClassificationNode, parent : AreasAndQueriesI[]) : void{

    var newProduct : AreasAndQueriesI = 
    {
        query: '',
        name: node.name,
        id: node.id,
        children: []
    };

    for ( var i in areaQueries)
    {
        if (areaQueries[i].id == node.id)
        {
            newProduct.query = areaQueries[i].query;
            break;
        }
    }

    parent.push(newProduct);

    if(node.children != undefined)
        node.children.forEach(child => loadProductsToAreas(child, newProduct.children));
}

// Gets the currently configured area paths, and the area paths in the system
async function LoadAreaPaths() {

    await getDoc("areaQueries").then(function (doc : docI) {
    areaQueries = doc.data;
    }).catch(function (err){
    if(err.status == 404){
            areaQueries = [];
        }else{
            // TODO: Hide the GUI? Alert?
            console.log("Error loading area queries " + JSON.stringify(err));
            return;
        }
    });

    await WIT.getClient().getRootNodes(VSS.getWebContext().project.name, 50)
    .then(function (retNodes : Contracts.WorkItemClassificationNode[]){
        projectAreas = retNodes[0];
    }, function (err){
        console.log("Failed to get area paths\n");
        console.log("err");
        // TODO, disable GUI?
        return;
    });

    // TODO: Prune the products/area list to only valid areas

    loadProductsToAreas(projectAreas, areasAndProducts);

    console.log(projectAreas);
    console.log(areasAndProducts);

    refreshGridFromData();
    grid.collapseAll();
    grid.expandByLevel(1);
}

var gridOptions : Grids.IGridOptions = {
    allowTextSelection: true,
    height: "80%",
    width: "100%",
    allowMultiSelect: false,
    columns: [
        { text: "Area", width: 300, index: "name" },
        { text: "Default Search Query", width: 400, index: "query" }
    ]
};

grid = Controls.create(Grids.Grid, $("#areaTree"), gridOptions);

$("#searchQuery").on('input',function (){
  $("#products").empty();

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

function repopulateAreaQueries(node : AreasAndQueriesI[]) : void
{
    for(var i in node){
        if(node[i].query.length > 0){
            areaQueries.push({id: node[i].id, query: node[i].query});
        }
        repopulateAreaQueries(node[i].children);
    }
}

export function saveAreaProducts(){
    // TODO Only save if loaded properly
    areaQueries = [];
    repopulateAreaQueries(areasAndProducts);
    setDoc("areaQueries",areaQueries, true); // TODO eTag stuff
}

VSS.ready(LoadAreaPaths);
