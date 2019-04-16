/// <reference types="vss-web-extension-sdk" />
import * as Controls from "VSS/Controls";
import * as Grids from "VSS/Controls/Grids";
import * as WIT from "TFS/WorkItemTracking/RestClient";
import * as Contracts from "TFS/WorkItemTracking/Contracts";
import * as lunr from "lunr";
//import * as PS from "ProductSelector";
import {allProducts, getRootNode, getDoc, setDoc, docI, productInfoI} from "./productshub";

export interface AreaProductsI {
    id: number;
    products: string[];
}

interface AreasAndProductsI{
    products: string[];
    name: string;
    id: number;
    children: AreasAndProductsI[];
}

var areaProducts : AreaProductsI[] = [];
var projectAreas : Contracts.WorkItemClassificationNode;
var areasAndProducts : AreasAndProductsI[] = [];
var selectedArea : AreaProductsI | undefined;

var grid : Grids.Grid;
var idx : lunr.Index;

$("#areaTree").on("click", function(){
    selectedArea = undefined;

    var selected = grid.getSelectedDataIndices();

    if(selected.length == 0){
      return;
    }

    selectedArea = grid.getRowData(selected[0]);
});

$("#newProductForAreaOk").on("click", function () {
    if(selectedArea != undefined)
    {
        var productNode = getRootNode(parseInt($("#products").val()));
        if(productNode)
        {
            if(productNode.active == true){
                selectedArea.products.push(productNode.key);
            }
        }
        grid.redraw();
    }else{
        alert("No area selected.");
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
function loadProductsToAreas(node : Contracts.WorkItemClassificationNode, parent : AreasAndProductsI[]) : void{

    var newProduct : AreasAndProductsI = 
    {
        products: [],
        name: node.name,
        id: node.id,
        children: []
    };

    for ( var i in areaProducts)
    {
        if (areaProducts[i].id == node.id)
        {
            newProduct.products = areaProducts[i].products;
            break;
        }
    }

    parent.push(newProduct);

    if(node.children != undefined)
        node.children.forEach(child => loadProductsToAreas(child, newProduct.children));
}

// Gets the currently configured area paths, and the area paths in the system
async function LoadAreaPaths() {

    await getDoc("areaProducts").then(function (doc : docI) {
    areaProducts = doc.data;
    }).catch(function (err){
    if(err.status == 404){
            areaProducts = [];
        }else{
            // TODO: Hide the GUI? Alert?
            console.log("Error loading area products " + JSON.stringify(err));
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
    height: "100%",
    width: "100%",
    allowMultiSelect: false,
    columns: [
        { text: "Area", width: 300, index: "name" },
        { text: "Valid Products", width: 6000, index: "products",
            getCellContents: function (rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder) : JQuery<HTMLElement> {
                var node : AreasAndProductsI = grid.getRowData(rowInfo.dataIndex);
                var out : JQuery<HTMLElement> = $("<div role='row' style='width:"+column.width+"px' class='grid-cell'></div>");
                var first : boolean = true;
                node.products.forEach(product => {
                    for(var i in allProducts)
                    {
                        if(allProducts[i].key == product){
                            // TODO put the div style into a CSS file
                            if(!first){
                                out.append(", ");
                            }
                            first = false;
                            out.append(allProducts[i].name);
                            out.append($(" <div style='display: inline; background-color: var(--component-label-default-color-hover); padding-left: 3px;padding-right: 3px;'><a href='#'>X</a></div>")
                                .on("click", function () {removeProductFromArea(product, node.id);}));
                            break;
                        }
                    }
                });
                return out;
            }
        }
    ]
};

function findArea(areaId: number, currentArea : AreasAndProductsI[]) : AreasAndProductsI | undefined
{
    var area :AreasAndProductsI;
    for( var i in currentArea)
    {
        area = currentArea[i];
        if(area.id == areaId){
            return area;
        }
        var inChildren = findArea(areaId, area.children);
        if( inChildren != undefined){
            return inChildren;
        }
    }
    return undefined;
}

function removeProductFromArea(productKey : string, areaId : number) : void{
    var area : AreaProductsI | undefined = findArea(areaId, areasAndProducts);
    if(area != undefined){
        area.products.splice(area.products.indexOf(productKey), 1);
        grid.redraw();
    }else{
        console.error("Could not find area: " + areaId);
    }
}

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

function repopulateAreaProducts(node : AreasAndProductsI[]) : void
{
    for(var i in node){
        if(node[i].products.length > 0){
            areaProducts.push({id: node[i].id, products: node[i].products});
        }
        repopulateAreaProducts(node[i].children);
    }
}

// Generally should be used after a call to repopulateAreaProducts
export function areaUsingProduct(product : productInfoI) : boolean {
    for(var i in areaProducts)
    {
        if(areaProducts[i].products.indexOf(product.key) >= 0){
            return true;
        }
    }
    return false;
}

export function saveAreaProducts(){
    // TODO Only save if loaded properly
    areaProducts = [];
    repopulateAreaProducts(areasAndProducts);
    setDoc("areaProducts",areaProducts, true); // TODO eTag stuff
}

VSS.ready(LoadAreaPaths);