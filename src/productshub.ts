/// <reference types="vss-web-extension-sdk" />
import * as PS from "ProductSelector";
import * as Controls from "VSS/Controls";
import * as Menus from "VSS/Controls/Menus";
import * as Grids from "VSS/Controls/Grids";
import * as lunr from "lunr";
import * as Navigation from "VSS/SDK/Services/Navigation";

interface productInfoI {
  name: string;
  key: string;
  source: string;
  imported: boolean;
  active: boolean;
  firstAvailable: string;
  children: Array<productInfoI>;
  gridKey: number;
}

// This really should be in the SDK somewhere but I couldn't find it
interface docI{
  id: string;
  __etag: number;
  data: any;
}

interface pmdmProductI {
  name: string;
  productId: string;
}

interface autocompleteI {
  label: string;
  value: string;
}

var localURL : string = 'https://azdo-dev.natinst.com/pmdmConnector';
var pmdmSoftwareProducts : Array<pmdmProductI> = [];
var pmdmHardwareProducts : Array<pmdmProductI> = [];
var allProducts : Array<productInfoI> = [];
var grid : Grids.Grid;
var menu : Menus.Menu<Menus.MenuBarOptions>;
var doingPMDMUpdate : boolean = false; // Used to flag that the page was loaded with the URL hast option to do an automated PMDM update
var productsLoaded : boolean = false; // Prevent saving if not loaded properly. This is mostly a failsafe for saves not triggered by the GUI, ie the PMDM update routine
var products__etag : number = 0;
var authorized : boolean = false;

function setAllActive(nodes : productInfoI[]) : void {
  nodes.forEach(function (node : productInfoI){
    node.active = true;
    setAllActive(node.children);
  });
}

function addGridKeys(row : productInfoI[] , currentKey : number ) : number{
  for(var i in row)
  {
    row[i].gridKey = currentKey;
    currentKey += 1;
    currentKey = addGridKeys(row[i].children,currentKey);
  }
  return currentKey;
}

function sortProducts(a : productInfoI,b : productInfoI) : number {
  if(typeof(a['name']) == 'undefined' || typeof(b['name']) == 'undefined'){
    return 1;
  }
  if(a['name'].toUpperCase() > b['name'].toUpperCase()){
    return 1;
  }else{
    return -1;
  }
}

// Sorts by firstAvailable or the node name
function sortProductsChildren(node1 : productInfoI, node2 : productInfoI) : number{
  if('firstAvailable' in node1 && 'firstAvailable' in node2)
  {
    // The date string is 'YYYY-MM-DD' so we can sort by ASCII
    if(node1.firstAvailable > node2.firstAvailable)
    {
      return -1;
    }else if (node1.firstAvailable < node2.firstAvailable){
      return 1;
    }else{
      if(node1.name.toLowerCase() < node2.name.toLowerCase()){
        return 1;
      }else{
        return -1;
      }
    }
  }else{
    if(node1.name.toLowerCase() < node2.name.toLowerCase()){
      return -1;
    }else{
      return 1;
    }
  }
}

function childrenContain(children : Array<productInfoI>, gridKey : number) : boolean{
  for(var i in children){
    if(children[i].gridKey == gridKey){
      return true;
    }
    if(childrenContain(children[i].children,gridKey))
      return true;
  }
  return false;
}

function getRootNode(gridKey : number) : productInfoI | null
{
  for(var i in allProducts)
  {
    if(allProducts[i].gridKey == gridKey){
      return allProducts[i];
    }
    if(childrenContain(allProducts[i].children,gridKey))
      return allProducts[i];
  }
  return null;
}

function getNode(gridKey : number, node : Array<productInfoI>) : productInfoI | null
{
  for(var i in node)
  {
    if(node[i].gridKey == gridKey){
      return node[i];
    }
    var node2 = getNode(gridKey, node[i].children);
    if(node2){
      return node2;
    }
  }
  return null;
}

function deleteItems(gridKeysToDelete : Array<number>) : void{
  var searchLen = allProducts.length;
  for(var i = 0;i<searchLen;i++){
    var childSearchLen = allProducts[i].children.length;
    for(var x = 0;x<childSearchLen;x++){
      if(gridKeysToDelete.indexOf(allProducts[i].children[x].gridKey) >= 0){
        allProducts[i].children.splice(x,1);
        x--;
        childSearchLen--;
      }
    }
    if(gridKeysToDelete.indexOf(allProducts[i].gridKey) >= 0){
      allProducts.splice(i,1);
      i--;
      searchLen--;
    }
  }
  refreshGrid();
  grid.collapseAll();
}

function deleteProductByKey(productKey : string) : void{
  var searchLen = allProducts.length;
  for(var i = 0;i<searchLen;i++){
    if(allProducts[i].key === productKey)
    {
      allProducts.splice(i,1);
      refreshGrid();
      return;
    }
  }
}

function refreshGrid() : void
{
  allProducts.sort(sortProducts);
  addGridKeys(allProducts,0);
  grid.setDataSource(new Grids.GridHierarchySource(allProducts));
}

// Unfortunately this doesn't catch if a user navigates within the settings pages
function flagDirty() : void
{
  window.onbeforeunload = function() {
    return "Are you sure you want to navigate away?";
  }
}

function clearDirty(){
  window.onbeforeunload = null;
}

function getDoc(file : string) : Promise<docI>{
  return new Promise(function(resolve, reject)
  {
    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService : IExtensionDataService) {
        // Get document by id
        dataService.getDocument(VSS.getWebContext().project.id, file).then(function(file : docI) {
          resolve(file);
        }, function (err){
          reject(err); // test for err.status == 404
        });
    });
  });
}

var gridOptions : Grids.IGridOptions = {
  allowTextSelection: true,
  height: "100%",
  width: "100%",
  columns: [
    { text: "Name", width: 450, index: "name" },
    { text: "Source", width: 60,
      getCellContents: function (rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder)  {
        var node : productInfoI = grid.getRowData(rowInfo.dataIndex);
        var root = getRootNode(node.gridKey);
        var divStuff : string = "role='row' style='width:"+column.width+"px' class='grid-cell'";
        if(node == root){
          return $("<div "+divStuff+" class='grid-cell'>"+node.source+"</div>");
        }else{
          return $("<div "+divStuff+" class='grid-cell'></div>");
        }
      }
    },
    { text: "Active", width: 60, getCellContents: function  (rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder)  {
        var node : productInfoI = grid.getRowData(rowInfo.dataIndex);
        var divStuff : string = "role='row' style='width:"+column.width+"px' class='grid-cell'";
        var text = node.active ? 'Y' : 'N';
        // Might be a more generic/cleaner way to bind the event but this works for now
        if(authorized){
          return $("<div "+divStuff+"><a href='#'>"+text+"</a></div>").on("click", () => { toggleActive(node.gridKey);});
        }else{
          return $("<div "+divStuff+">"+text+"</div>");
        }
      }
    },
//            { text: "Key", width: 120, index: "key" },
    { text: "First Available", width: 100,
      getCellContents: function (rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder)  {
        var node : productInfoI = grid.getRowData(rowInfo.dataIndex);
        var root = getRootNode(node.gridKey);
        var divStuff = "role='row' style='width:"+column.width+"px' class='grid-cell'";
        if(root != null && node != root){
          if(root.imported || !authorized){
            // Imported products don't allow the user to change the date
            var text = 'firstAvailable' in node ? node.firstAvailable : '';
            return $("<div "+divStuff+">"+text+"</div>");
          }else{
            var text = node.firstAvailable.length > 0 ? node.firstAvailable : "Set Date";
            return $("<div "+divStuff+"><a href='#'>"+node.firstAvailable+"</a></div>").on("click", () => { setDate(node.gridKey);}) ;
          }
        }else{
          return $("<div "+divStuff+"></div>");
        }
      }
    }
  ]
};

function toggleActive(gridKey : number) : void {
  var ret : any = getNode(gridKey, allProducts);
  if(ret == null) {
    return;
  }

  var node : productInfoI = ret;
  node.active = !node.active;

  grid.redraw();
}

function setDate(gridKey : number) : void
{
  var ret1 : any = getNode(gridKey, allProducts);
  var ret2 : any = getRootNode(gridKey);
  if(ret1 == null || ret2 == null) {
    return;
  }

  var node : productInfoI = ret1;
  var rootNode : productInfoI = ret2;
  $("#datePickerProduct").html(rootNode.name);
  $("#datePickerVersion").html(node.name);
  $("#datePickerPicker").val(node.firstAvailable);
  $("#datePickerGridKey").val(gridKey);
  $("#datePickerModal").modal();
}

$("#datePickerCompletion").on("click", () => {
  var gridKey = parseInt($("#datePickerGridKey").val());
  var ret1 : any = getNode(gridKey, allProducts);
  if(ret1 == null) {
    return;
  }
  var node : productInfoI = ret1;
  node.firstAvailable = $('#datePickerPicker').datepicker('getFormattedDate');
  grid.redraw();
});

function loadGridFromDB() : void{
  getDoc("products").then( function(result : docI){
    allProducts = result.data;
    products__etag = result.__etag;
    refreshGrid();
    $("#main-container").removeAttr("hidden");
    VSS.notifyLoadSucceeded();
    grid.collapseAll();
    productsLoaded = true;
    checkHashValue();
  },
    function(err){
      if(err.status == 404){
        allProducts = [];
        refreshGrid();
        $("#main-container").removeAttr("hidden");
        VSS.notifyLoadSucceeded();
      }else{
        console.log("Error loading all docs " + JSON.stringify(err));
      }
    }
  );
}

function productKeyExists(key : string) : boolean
{
  for(var i in allProducts){
    if( allProducts[i].key == key){
      return true;
    }
  }
  return false;
}

function getPMDMSoftwareProduct(productId : string) {
  return new Promise((resolve, reject) => { $.ajax({url: localURL+"/pmdmsoftwareproduct?productId="+productId})
      .then( function (result: string){
        var products : productInfoI = JSON.parse(result);
        resolve(products);
      })
      .fail( function () {
          reject(undefined);
      });
  });
}

function getPMDMHardwareProduct(productId : string) {
  return new Promise((resolve, reject) => { $.ajax({url: localURL+"/pmdmhardwareproduct?productId="+productId})
      .then( function (result: string){
        var products : productInfoI = JSON.parse(result);
        resolve(products);
      })
      .fail( function () {
          reject(undefined);
      });
  });
}

function SoftwareProductFromPMDM(productId : string) : void {
  // TODO Sanitize product names from pmdm
  getPMDMSoftwareProduct(productId).then( function (product : productInfoI) {
    if(productKeyExists(product.key)){
      alert("Product already exists.");
    }else{
      flagDirty();
      setAllActive([product]);
      allProducts.push(product);
      refreshGrid();
    }
  }).catch( function (errString : string){
    alert("Failed to get product: " + errString);
  });
}

function HardwareProductFromPMDM(productId : string) : void {
  // TODO Sanitize product names from pmdm
  getPMDMHardwareProduct(productId).then( function (product : productInfoI) {
    if(productKeyExists(product.key)){
      alert("Product already exists.");
    }else{
      flagDirty();
      setAllActive([product]);
      allProducts.push(product);
      refreshGrid();
    }
  }).catch( function (errString : string){
    alert("Failed to get product: " + errString);
  });
}

// Autocomplete for the pmdm dialog
$.ajax({url: localURL+"/pmdmsoftwareproducts", success: function(result){
  pmdmSoftwareProducts = JSON.parse(result);
  pmdmSoftwareProducts.sort();
  var tagValues : Array<autocompleteI> = [];
  for(var product in pmdmSoftwareProducts){
    tagValues.push({label:pmdmSoftwareProducts[product].name, value:pmdmSoftwareProducts[product].productId})
  }
  $( "#tags" ).autocomplete({
    source: tagValues,
    select: function(event, ui)
            {
              $("#toAddPMDMid").val(ui.item.value);
              $("#tags").val(ui.item.label);
              return false;
            },
    focus: function(event, ui){
              return false;
            },
    appendTo: ".pmdmAutoFill"
  });
  setMenuItemDisabled("import-pmdm-software",false);
}});

// Autocomplete for the pmdm dialog
$.ajax({url: localURL+"/pmdmhardwareproducts", success: function(result){
  pmdmHardwareProducts = JSON.parse(result);
  pmdmHardwareProducts.sort();
  var tagValues : Array<autocompleteI> = [];
  for(var product in pmdmHardwareProducts){
    tagValues.push({label:pmdmHardwareProducts[product].name, value:pmdmHardwareProducts[product].productId})
  }
  $( "#hardwareTags" ).autocomplete({
    source: tagValues,
    select: function(event, ui)
            {
              $("#toAddPMDMHardwareid").val(ui.item.value);
              $("#hardwareTags").val(ui.item.label);
              return false;
            },
    focus: function(event, ui){
              return false;
            },
    appendTo: ".pmdmHardwareAutoFill"
  });
  setMenuItemDisabled("import-pmdm-hardware",false);
}});

/*
function addAllSoftwareProducts(){
  flagDirty();
  for(var id in pmdmSoftwareProducts)
  {
    var productId = pmdmSoftwareProducts[id].productId;
    $.ajax({url: localURL+"/pmdmsoftwareproduct?productId="+productId, async:false, success: function(result){
      var products = JSON.parse(result);
      if(!productKeyExists(products.key)){
        setAllActive([products]);
        allProducts.push(products);
      } 
    }});
  }
  refreshGrid();
}

function addAllHardwareProducts(){
  flagDirty();
  for(var id in pmdmHardwareProducts)
  {
    var productId = pmdmHardwareProducts[id].productId;

    $.ajax({url: localURL+"/pmdmhardwareproduct?productId="+productId, async:false, success: function(result){
      var products = JSON.parse(result);
      if(!productKeyExists(products.key)){
        setAllActive([products]);
        allProducts.push(products);
      } 
    }});
  }
  refreshGrid();
}
*/

function findSoftwareProduct(id: string) : pmdmProductI | null{
  for(var i in pmdmSoftwareProducts){
    if(pmdmSoftwareProducts[i].productId == id){
      return pmdmSoftwareProducts[i];
    }
  }
  return null;
}

$("#pmdm-software-dialog-ok").on('click', () => {
  var found = findSoftwareProduct($("#toAddPMDMid").val());
  if(found == null ){
    alert($("#tags").val() + " not found");
  }else{
    flagDirty();
    SoftwareProductFromPMDM(found.productId);
  }
  $("#tags").val("");
  $("#toAddPMDMid").val("");
});

function findHardwareProduct(id: string) : pmdmProductI | null {
  for(var i in pmdmHardwareProducts){
    if(pmdmHardwareProducts[i].productId == id){
      return pmdmHardwareProducts[i];
    }
  }
  return null;
}

$("#pmdm-hardware-dialog-ok").on('click', () => {
  var found = findHardwareProduct($("#toAddPMDMHardwareid").val());
  if(found == null ){
    alert($("#toAddPMDMHardwareid").val() + " not found");
  }else{
    flagDirty();
    HardwareProductFromPMDM(found.productId);
  }
  $("#hardwareTags").val("");
  $("#toAddPMDMHardwareid").val("");
});

function newProductCompletion() : void {
  flagDirty();
  var product : string = $("#newManualProductName").val();
  if (product != "") {
    var key : string = sanitizeKey("custom" + product);
    if(productKeyExists(key)){
      alert("Product already exists.")
    }else{
      allProducts.push({
        name: sanitizeProductName(product),
        children: [],
        imported: false,
        source: 'AzDO',
        key: key,
        active: true,
        firstAvailable: '',
        gridKey: -1
      });
      refreshGrid();
    }
  }else{
    // TODO
  }
  $("#newManualProductName").val("");
}

$("#new-manual-product-ok").on('click', () => { newProductCompletion(); });

function newVersionPopup(){
  var selected = grid.getSelectedDataIndices();
  if(selected.length == 0){
    alert("No product selected.\n");
    return;
  }
  if(selected.length > 1){
    alert("Only select one product for a new version.\n");
    return;
  }

  var node : productInfoI | null = getRootNode(grid.getRowData(selected[0]).gridKey);

  if(node == null){
    // TODO
    return;
  }

  if(node.imported){
    alert("Cannot add versions to imported products.\n");
    return;
  }

  $("#newProductVersionName").html("New Product Version - " + node.name);
  $('#newProductVersionModal').modal();
  $('#newVersionProduct').val(node.gridKey);
}

$("#new-version-dialog-ok").on('click', () => {
  flagDirty();
  var productNode = getRootNode($('#newVersionProduct').val());

  if(productNode == null){
    //TODO alert
    return;
  }

  // TODO: Validate new-version-date
  productNode.children.push({
    name: $('#newVersionName').val(),
    children: [],
    key: sanitizeKey($('#newVersionName').val()),
    firstAvailable: $('#new-version-date').datepicker('getFormattedDate'),
    active: true,
    source: '',
    imported: false,
    gridKey: -1
  });

  productNode.children.sort(sortProductsChildren);
  refreshGrid();
});

function sanitizeProductName(name : string) : string{
  return name.replace(/;/g,"");
}

function sanitizeKey(key : string) : string{
  return key.toLowerCase().replace(/,/g,"").replace(/;/g,"").replace(/ /g,"").replace(/&/g,"");
}

function setDoc(file : string, contents : any, forceSet? : boolean, etag? : number) : Promise<docI> { 
  return new Promise((resolve, reject) => {
    forceSet = forceSet || false;
    etag = etag || 0;
    if(forceSet){ // Bypasses the consistency check of the tag
      etag = -1
    }
    var myDoc = {
      id: file,
      data: contents,
      __etag: etag
    };

    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService : IExtensionDataService) {
      dataService.setDocument(VSS.getWebContext().project.id, myDoc).then(function(doc : docI) {
        resolve(doc);
      }, function (err){
        console.log("Error setting document "+file+" on remote serner.");
        alert("Error setting document "+file+" on remote serner.");
        reject();
      });
    }, function (err){
        console.log("Error getting service.");
        alert("Error getting service.");
        reject();
      }
    );
  });
}

function mergeActiveFlags(product : productInfoI) : void
{
  for(var i in allProducts){
    if(allProducts[i].key == product.key){
      product.active = allProducts[i].active;
      allProducts[i].children.forEach(function (child) {
        for(var child2 in product.children){
          if(product.children[child2].key == child.key){
            product.children[child2].active = child.active;
            break;
          }
        }
      });
      return;
    }
  }
  console.error("Couldn't find product in grid: " + JSON.stringify(product));
  return;
}

$("#pmdmUpdateModal").on("shown.bs.modal",
async function () {
  flagDirty();

  var productsToUpdate : Array<string> = [];
  var indices = grid.getSelectedDataIndices();

  if(indices.length == 0){
    $("#pmdmUpdateModal").modal('hide');
    alert("No items selected.");
    return;
  }

  for(var i in indices){
    var rowData : productInfoI = grid.getRowData(indices[i]);
    var rootNode : productInfoI | null = getRootNode(rowData.gridKey);
    if(rootNode !== null){
      if(!rootNode.imported || rootNode.source != "pmdm"){
        if(!doingPMDMUpdate) 
        {
          alert("Product " + rootNode.name + " not from pmdm");
        }
        continue;
      }else{
        productsToUpdate.push(rootNode.key);
      }
    }
  }

  for (var i in productsToUpdate){
    var pmdmType = productsToUpdate[i].substring(0,5);
    var pmdmProductId = productsToUpdate[i].substring(5);

    $("#pmdmUpdateStatus").html("Updating " + i + " of " + productsToUpdate.length + ".");

    if(pmdmType == "pmdms"){
      await getPMDMSoftwareProduct(pmdmProductId).then(function (product : productInfoI) {
        setAllActive([product]);
        mergeActiveFlags(product);
        deleteProductByKey(product.key);
        allProducts.push(product);
      }).catch( function (error: string) {
        console.log("Error getting PMDM Software Product "+pmdmProductId+": " + error);
      });
    }else if(pmdmType == "pmdmh"){
      await getPMDMHardwareProduct(pmdmProductId).then(function (product : productInfoI) {
        setAllActive([product]);
        mergeActiveFlags(product);
        deleteProductByKey(product.key);
        allProducts.push(product);
      }).catch( function (error: string) {
        console.log("Error getting PMDM Software Product "+pmdmProductId+": " + error);
      });
    }else{
      alert("Invalid pmdm key.");
    }
  }
  refreshGrid();
  $("#pmdmUpdateModal").modal('hide');

  if(doingPMDMUpdate){
    saveAll();
  }
});

$('#new-version-date').datepicker({
  // @ts-ignore It's getting the types from the wrong datepicker type
  format: "yyyy-mm-dd"
});

$('#datePickerPicker').datepicker({
  // @ts-ignore It's getting the types from the wrong datepicker type
  format: "yyyy-mm-dd"
});

$('#pmdmModal').on('shown.bs.modal', function () {
    $('#tags').trigger('focus');
});

$('#pmdmHardwareModal').on('shown.bs.modal', function () {
  $('#hardwareTags').trigger('focus');
});

$('#manualModal').on('shown.bs.modal', function () {
  $('#newManualProductName').focus();
});

function hasActiveChild(node: productInfoI) : boolean {
  if(node.children !== undefined){
    for(var i in node.children)
    {
      if(node.children[i].active == true){
        return true;
      }
    }
  }
  return false;
}

async function saveAll()
{
  if(!productsLoaded){
    // This should never be hit by the user but a script hit this case during testing
    alert("Products weren't loaded, no saving a bad list!");
    console.log("Products weren't loaded, no saving a bad list!");
    return;
  }

  // Save the main config used by the hub
  setDoc("products", allProducts, false, products__etag).then( async (doc : docI) => {
    products__etag = doc.__etag;

    // Generate the condensed objects for the search indexer and selector form 

    var fullTreeCollapsed : Array<PS.productTreeI> = []; // Removes Extraneous fields
    allProducts.forEach(function (product : productInfoI){
      if(product.active === true || hasActiveChild(product)){
        var toAdd : PS.productTreeI = { name: product.name, key: product.key};
        if(product.active === false ){
          toAdd.hidden = true;
        }
        if(product.children !== undefined){
          if(product.children.length > 0){
            toAdd.children = [];
            for(var x in product.children) {
              if(product.children[x].active === true){
                toAdd.children.push({ name: product.children[x].name, key: product.children[x].key});  
              }
            }
          }
        }
        fullTreeCollapsed.push(toAdd);
      }
    });

    var flatProducts : Array<{name: string, i:string}> = [];
    fullTreeCollapsed.forEach(function (t : PS.productTreeI){
      flatProducts.push({name: t.name, i: ''})
      if(t.children !== undefined){
        t.children.forEach(function (c){
          flatProducts.push({name: t.name + ": " + c.name, i: ''}) 
        });
      }
    });

    // Remove the stop word filter from the indexing process.
    // Otherwise you can't search for 'CAN' devices.
    // Looking at the lunr code and filtered words it doesn't seem to be necessary for our dataset of product names
    // @ts-ignore Best way I could find to do this without touching the lunr source
    lunr.stopWordFilter =  lunr.generateStopWordFilter([]);
    lunr.Pipeline.registerFunction(lunr.stopWordFilter, 'stopWordFilter')

    var idx = lunr(function(builder) {
      this.ref('i');
      this.field('name');
      for (var i in flatProducts) {
        flatProducts[i].i=i;
        this.add(flatProducts[i]);
      }
    });

    await setDoc("allproducts",{idx: JSON.stringify(idx), products: fullTreeCollapsed}, true);

    clearDirty();
    $("#savingModal").modal('hide');
    if(doingPMDMUpdate){
      var time = new Date();
      setDoc("pmdmUpdateTime",time.getTime() + ": " + time.toDateString(), true);
    }
    console.log("All Saved"); // Used by puppeteer update scripts, don't change this text
  }).catch( function () {
    alert("Error saving the products, someone may have been working on this page too and saved before you. All changes will be lost.");
    location.reload();
  });
}

$("#savingModal").on("shown.bs.modal", async function ()
{
  saveAll();
});

var menuItems : Array<Menus.IMenuItemSpec> = [
  { id: "new-product", text: "New Product",  noIcon: true  },
  { separator: true },
  { id: "new-version", text: "New Version", noIcon: true },
  { separator: true },
  { id: "import-pmdm-software", text: "Import Software - PMDM", disabled: true, noIcon: true },
  { separator: true},
  { id: "import-pmdm-hardware", text: "Import Hardware - PMDM", disabled: true, noIcon: true },
  { separator: true},
  { id: "update-from-pmdm", text: "Update PMDM Product", noIcon: true},
  { separator: true},
/*
  { id: "import-1000-software", text: "All Software ", noIcon: true },
  { separator: true },
  { id: "import-1000-hardware", text: "All Hardware", noIcon: true },
  { separator: true },
  */

  { id: "delete-items", text: "Delete Selected", noIcon: true },
  { separator: true },
  { id: "save", text: "Save", noIcon: true },
  { separator: true }
];


var menubarOptions : Menus.MenuBarOptions = {
  items: menuItems,
  executeAction: function (args) {
    var command = args.get_commandName();
    switch (command) {
      case "new-product":
        $("#manualModal").modal();
        break;
      case "new-version":
        newVersionPopup();
        break;
      case "import-pmdm-software": 
        $("#pmdmModal").modal();
        break;
      case "import-pmdm-hardware":
        $("#pmdmHardwareModal").modal();
        break;
/*
      case "import-1000-software":
        addAllSoftwareProducts();
        break;
      case "import-1000-hardware":
        addAllHardwareProducts();
        break;
*/        
      case "delete-items":
        var gridKeysToDelete : Array<number> = [];
        var indices = grid.getSelectedDataIndices();

        if(indices.length == 0){
          alert("No items selected.");
          return;
        }

        flagDirty();

        for(var i in indices){
          var rowData : productInfoI = grid.getRowData(indices[i]);
          gridKeysToDelete.push( rowData.gridKey);
        }

        deleteItems(gridKeysToDelete);
        break;
      case "save":
        $("#savingModal").modal();
        break;
      case "update-from-pmdm":
        $("#pmdmUpdateStatus").html('');
        $("#pmdmUpdateModal").modal();
        break;
      default:
        alert("Unhandled action: " + command);
        break;
    }
  }
};

menu = Controls.create(Menus.MenuBar, $("#menubar"), menubarOptions);

function setMenuItemDisabled(id: string, value: boolean) : void
{
  for(var i in menuItems)
  {
    if(menuItems[i].id == id){
      menuItems[i].disabled = value;
      menu.updateItems(menuItems);
      return;
    }
  }
}

$('#newManualProductName').keypress(function(event) {
  if (event.keyCode == 13 || event.which == 13) {
    $("#manualModal").modal('hide');
    newProductCompletion();
  }
});

async function restCall(token : string, url : string) : Promise<{}> {
  // TODO: Handle continuations
  return new Promise(function(resolve, reject)
  {
    $.ajax({
      url: url ,
      dataType: 'json',
      headers: { 'Authorization': 'Basic ' + btoa(":"+token)}
    }).done( function (data) {
      resolve(data);
    }).fail( function (error){
      reject(error);
    });
  });
}

interface groupI {
  subjectKind: string,
  description: string,
  domain: string,
  principalName: string,
  mailAddress: string,
  origin: string,
  originId: string,
  displayName: string,
  _links: {self: string, memberships: string, membershipState: string, storageKey: string},
  url: string,
  descriptor: string,
}

interface restGroupsI {
  count: number;
  value: Array <groupI>;
}

async function checkUserAccess()
{
  VSS.getAccessToken().then(async function(tokenP){
    var token : string = tokenP.token;
    var webContext = VSS.getWebContext();
    var org = webContext.collection.name;
    var userID = webContext.user.id;
    var userDescriptor : string = '';


    await restCall(token,"https://vssps.dev.azure.com/"+org+"/_apis/graph/descriptors/"+userID+"?api-version=5.0-preview.1")
    .then(function (data : {value: string}) {
      userDescriptor = data.value;
    })
    .catch(function (){
      // No real case the user should ever hit this case
      alert("Unable to fetch the user descriptor. You won't be able to make any changes.");
      return;
    })

    var groups : Array<groupI> = []; // Should make a type for this
    await restCall(token, "https://vssps.dev.azure.com/"+org+"/_apis/graph/groups?api-version=5.0-preview.1")
    .then(function (data : restGroupsI) {
      groups = data.value;
    })
    .catch(function (){
      // No real case the user should ever hit this case
      alert("Unable to fetch the group list. You won't be able to make any changes.");
      return;
    })

    var groupName = "["+webContext.project.name+"]\\Product Administrators";
    groupName = groupName.toUpperCase();
    var groupDescriptor = ''
    for(var i in groups)
    {
      if(groups[i].principalName.toUpperCase() == groupName)
      {
        groupDescriptor = groups[i].descriptor;
        break;
      }
    }
    if(groupDescriptor == '')
    {
      $("#error-text").html("'Product Administrators' group not found in project.");
      return;
    }
    
    // This call does a 404 if the user is not in the group
    restCall(token,"https://vssps.dev.azure.com/" + org + "/_apis/graph/memberships/" + userDescriptor + "/" + groupDescriptor + "?api-version=5.0-preview.1")
    .then( function () {
      //User is authorized
      authorized = true;
      $("#menubar").removeAttr("hidden");
    })
    .catch( function() {
      authorized = false;
      $("#error-text").html("You must be a member of 'Product Administrators' to edit the product database.");
    });

  });
}

function checkHashValue() : void
{
  VSS.getService(VSS.ServiceIds.Navigation).then(function (navigationService : Navigation.HostNavigationService) {
    navigationService.getHash().then(function (hash) {
      if(hash == 'doPMDMUpdate'){
        doingPMDMUpdate = true;
        console.log("Doing automated PMDM Update");
        grid.selectAll();
        $("#pmdmUpdateModal").modal();
      }
    });
  });
}

grid = Controls.create(Grids.Grid, $("#productTree"), gridOptions);
loadGridFromDB();
VSS.ready(checkUserAccess);

getDoc("pmdmUpdateTime").then(
  function (doc){
    $("#pmdm-update-time").html(doc.data);
  }
).catch(function () {
  $("#pmdm-update-time").attr("hidden");
});