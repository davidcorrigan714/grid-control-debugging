/// <reference types="vss-web-extension-sdk" />
import * as PS from "ProductSelector";
import * as Controls from "VSS/Controls";
import * as Menus from "VSS/Controls/Menus";
import * as Grids from "VSS/Controls/Grids";
import * as lunr from "lunr";

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
//var authorized : boolean = false;

// TODO Disable things if PMDM connection doesn't work

function setAllActive(nodes : productInfoI) : void {
  for(var i in nodes){
    nodes[i].active = true;
    setAllActive(nodes[i].children);
  }
}

function addGridKeys(row, currentKey : number ) : number{
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
      if(gridKeysToDelete.indexOf(allProducts[i].children[x].gridKey) > 0){
        allProducts[i].children.splice(x,1);
        x--;
        childSearchLen--;
      }
    }
    if(gridKeysToDelete.indexOf(allProducts[i].gridKey) > 0){
      allProducts.splice(i,1);
      i--;
      searchLen--;
    }
  }
  refreshGrid();
}

/*
function updateProductInfoSidebar() : void{
  var indices = grid.getSelectedDataIndices();

  if(indices.length == 1) {
    var rowData = grid.getRowData(indices[0]);
    var rootNode = getRootNode(rowData.gridKey);

    // Root node is the product name
    $("#info-product").html(rootNode.name);

    $("#info-key").html(rowData.key);
    if (rowData.gridKey == rootNode.gridKey){
      // Root Node
      $("#info-version").html('');
      $("#info-external-update").attr("hidden",!rootNode.imported || !authorized);
      $("#info-date-area").attr("hidden",true);
      if(rootNode.imported){
        $("#info-imported").text("Imported from " + rootNode.source + ".");
      }else{
        $("#info-imported").text("");
      } 
    }else{
      // Not the root node
      $("#info-version").html(rowData.name);
      $("#info-date").attr("readonly", rootNode.imported || !authorized);
      $("#info-date").datepicker('update',rowData.firstAvailable);
      $("#info-date-area").attr("hidden",false);
      $("#info-imported").text("");
      $("#info-external-update").attr("hidden",true);
    }
  }else{
    ResetProductInfo();
  }
}
*/

function refreshGrid() : void
{
  allProducts.sort(sortProducts);
  addGridKeys(allProducts,0);
  grid.setDataSource(new Grids.GridHierarchySource(allProducts));
  grid.collapseAllNodes();
}

function flagDirty() : void
{
  window.onbeforeunload = function() {
    return "Are you sure you want to navigate away?";
  }
}

function clearDirty(){
  window.onbeforeunload = null;
}

function getDoc<T>(file : string) : Promise<T>{
  return new Promise(function(resolve, reject)
  {
    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService : IExtensionDataService) {
        // Get document by id
        dataService.getDocument(VSS.getWebContext().project.id, file).then(function(file) {
          resolve(file.data);
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
        if('active' in node && node.active){
          return $("<div "+divStuff+"><a href='#' onClick='toggleActive("+node.gridKey+")'>Y</a></div>");
        }else{
          return $("<div "+divStuff+"><a href='#' onClick='toggleActive("+node.gridKey+")'>N</a></div>");
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
          if(root.imported){
            // TODO TS doesn't like that 'firstAvailable' might not be in node
            if('firstAvailable' in node){
              return $("<div "+divStuff+">"+node.firstAvailable+"</div>");
            }else{
              return $("<div "+divStuff+"></div>");
            }
          }else{
            // TODO
            //if('firstAvailable' in node){
              return $("<div "+divStuff+"><a href='#' onClick='setDate("+node.gridKey+");'>"+node.firstAvailable+"</a></div>");
            //}else{
            //  return $("<div "+divStuff+"><a href='#' onClick='setDate("+node.gridKey+");'); return false;'>Set Date</a></div");
            //}
          }
        }else{
          return $("<div "+divStuff+"></div>");
        }
      }
    }
  ]
};

// This is used for the onClick of the active field on the grid
// Might have a better way to do this that makes TS happy but I'm not figuring it out atm
// @ts-ignore
function toggleActive(dataIndex : number) : void
{
  var ret : any = getNode(dataIndex, allProducts);
  if(ret == null) {
    return;
  }

  var node : productInfoI = ret;
  node.active = !node.active;

  grid.redraw();
}

/*
function setDate(dataIndex)
{
  console.log("Date: " + dataIndex);
  return false;
}
*/

function loadGridFromDB() : void{
  getDoc<Array<productInfoI>>("products").then( function(result){
    allProducts = result;
    refreshGrid();
    $("#main-container").removeAttr("hidden");

    VSS.notifyLoadSucceeded();
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

// TODO
/*
$('#info-date').datepicker({
  format: "yyyy-mm-dd",
  enableOnReadonly: false
});
*/

$('#info-date').on('changeDate', function (){
  // TODO
  flagDirty();
  // var ref = $('#jstree_demo').jstree(true);
  // var node = $('#info-node').val();
  // ref.get_node(node).original.firstAvailable = $('#info-date').datepicker('getFormattedDate');
  // ref.sort(ref.get_node(ref.get_node(node).parent).id, true);
});

/*
function ResetProductInfo(){
  $("#info-product").html("Selected Prodcut");
  $("#info-version").html("");
}
*/

function productKeyExists(key : string) : boolean
{
  for(var i in allProducts){
    if( allProducts[i].key == key){
      return true;
    }
  }
  return false;
}

function SoftwareProductFromPMDM(productId : string) : void{
  // TODO Sanitize product names from pmdm
  flagDirty();
  $.ajax({url: localURL+"/pmdmsoftwareproduct?productId="+productId, success: function(result){
    var products : productInfoI = JSON.parse(result);
    if(productKeyExists(products.key)){
      alert("Product already exists.");
    }else{
      setAllActive(products);
      allProducts.push(products);
      refreshGrid();
    }
  }});
}

function HardwareProductFromPMDM(productId : string) : void{
  // TODO Sanitize product names from pmdm
  flagDirty();
  $.ajax({url: localURL+"/pmdmhardwareproduct?productId="+productId, success: function(result){
    var products : productInfoI = JSON.parse(result);
    if(productKeyExists(products.key)){
      alert("Product already exists.");
    }else{
      setAllActive(products);
      allProducts.push(products);
      refreshGrid();
    }
  }});
}

// Autocomplete for the pmdm dialog
$.ajax({url: localURL+"/pmdmsoftwareproducts", success: function(result){
  var pmdmSoftwareProducts : Array<pmdmProductI> = JSON.parse(result);
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
}});

function addAllSoftwareProducts(){
  flagDirty();
  for(var id in pmdmSoftwareProducts)
  {
    var productId = pmdmSoftwareProducts[id].productId;
    $.ajax({url: localURL+"/pmdmsoftwareproduct?productId="+productId, async:false, success: function(result){
      var products = JSON.parse(result);
      if(!productKeyExists(products.key)){
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
        allProducts.push(products);
      } 
    }});
  }
  refreshGrid();
}

function findSoftwareProduct(name: string) : pmdmProductI | null{
  for(var i in pmdmSoftwareProducts){
    if(pmdmSoftwareProducts[i].name == name){
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

function findHardwareProduct(name: string) : pmdmProductI | null {
  for(var i in pmdmHardwareProducts){
    if(pmdmHardwareProducts[i].name == name){
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

function newProductCompletion() : void{
  flagDirty();
  var product : string = $("#newManualProductName").val();
  console.log("Adding: "+product);
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
      console.log("Added");
    }
  }else{
    // TODO
  }
  $("#newManualProductName").val("");
}

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

function setDoc(file : string, contents : any, force? : boolean){
  force = force || false;
  console.log("Trying to save"+file);
  var myDoc = {
    id: file,
    data: contents,
    __etag: -1 //TODO Not this
  };

  VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService : IExtensionDataService) {
    console.log("Got the service");
    dataService.setDocument(VSS.getWebContext().project.id, myDoc).then(function(doc) {
      console.log("Saved "+file);
    }, function (err){
      console.log("Error setting document"+file+"on remote serner.");
      alert("Error setting document"+file+"on remote serner.");
    });
  }, function (err){
      console.log("Error getting service.");
      alert("Error getting service.");
    }
  );
}

// TODO fix up this function and add it ot the gui
// @ts-ignore
function updateFromPMDM() : void{
  flagDirty();
  var selected = grid.getSelectedDataIndices();
  if(selected.length != 1){
    alert("Invalid Selection\n");
    return;
  }

  var rootNode : productInfoI | null = getRootNode(grid.getRowData(selected[0]).gridKey);

  if(rootNode == null){
    alert("ERROR updateFromPMDM couldn't get rootNode");
    return;
  }

  if(!rootNode.imported || rootNode.source != "pmdm"){
    alert("Product not from pmdm");
    return;
  }

  var pmdmType = rootNode.key.substring(0,5);
  var pmdmProductId = rootNode.key.substring(5);

  if(pmdmType == "pmdms"){
    deleteItems([rootNode.gridKey]);
    SoftwareProductFromPMDM(pmdmProductId);
    alert("Product updated\n");
  }else if(pmdmType == "pmdmh"){
    deleteItems([rootNode.gridKey]);
    HardwareProductFromPMDM(pmdmProductId);
    alert("Product updated\n");
  }else{
    alert("Invalid pmdm key.");
  }
}

// TODO
/*
$('#new-version-date').datepicker({
  format: "yyyy-mm-dd",
  enableOnReadonly: false
});*/

$('#pmdmModal').on('shown.bs.modal', function () {
    $('#tags').trigger('focus');
});

$('#pmdmHardwareModal').on('shown.bs.modal', function () {
  $('#hardwareTags').trigger('focus');
});

$('#manualModal').on('shown.bs.modal', function () {
  $('#newManualProductName').focus();
});

function save()
{
  // Save the main config used by the hub
  setDoc("products", allProducts);

  // Generate the condensed objects for the search indexer and selector form 

  var fullTreeCollapsed : Array<PS.productTreeI> = []; // Removes Extraneous fields
  for (var i in allProducts) {
    var toAdd : PS.productTreeI = { name: allProducts[i].name, key: allProducts[i].key, children: [] };
    for(var x in allProducts[i].children) {
      toAdd.children.push({ name: allProducts[i].children[x].name, key: allProducts[i].children[x].key, children: [] });  
    }
    fullTreeCollapsed.push(toAdd);
  }

  var flatProducts : Array<{name: string, i:string}> = [];
  for(var i in fullTreeCollapsed){ // Collapses the tree into a flat list for the index
    flatProducts.push({name: fullTreeCollapsed[i].name, i: ''})
    for(var x in fullTreeCollapsed[i].children){
      flatProducts.push({name: fullTreeCollapsed[i].name + ": " + fullTreeCollapsed[i].children[x].name, i: ''})
    }
  }

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

  setDoc("allproducts",{idx: JSON.stringify(idx), products: fullTreeCollapsed});

  clearDirty();
  console.log("Done saving!");
}

var menuItems : Array<Menus.IMenuItemSpec> = [
  { id: "new-product", text: "New Product",  noIcon: true  },
  { separator: true },
  { id: "new-version", text: "New Version", noIcon: true },
  { separator: true },
  { id: "import-pmdm-software", text: "Import Software - PMDM", noIcon: true },
  { separator: true},
  { id: "import-pmdm-hardware", text: "Import Hardware - PMDM", noIcon: true },
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
      case "import-1000-software":
        addAllSoftwareProducts();
        break;
      case "import-1000-hardware":
        addAllHardwareProducts();
        break;
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
        save();
        break;
      default:
        alert("Unhandled action: " + command);
        break;
    }
  }
};
Controls.create(Menus.MenuBar, $("#menubar"), menubarOptions);

$('#newManualProductName').keypress(function(event) {
  if (event.keyCode == 13 || event.which == 13) {
    $("#manualModal").modal('hide');
    newProductCompletion();
  }
});

function restCall(token : string, url : string){
  var ret : any;
  $.ajax({
      async:false,
      url: url ,
      dataType: 'json',
      headers: { 'Authorization': 'Basic ' + btoa(":"+token)},
      success: function(data, textStatus, request){
        ret = data;
        // TODO: Handle continuations
        //console.log(request.getResponseHeader('X-MS-ContinuationToken'));
      }
  });
  return ret;
}

function checkUserAccess() : void
{
  VSS.getAccessToken().then(function(tokenP){
    var token : string = tokenP.token;
    var webContext = VSS.getWebContext();
    var org = webContext.collection.name;
    var userID = webContext.user.id;
    
    var userDescriptor = restCall(token,"https://vssps.dev.azure.com/"+org+"/_apis/graph/descriptors/"+userID+"?api-version=5.0-preview.1").value;

    var groups = restCall(token, "https://vssps.dev.azure.com/"+org+"/_apis/graph/groups?api-version=5.0-preview.1").value;
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
    var auth = restCall(token,"https://vssps.dev.azure.com/" + org + "/_apis/graph/memberships/" + userDescriptor + "/" + groupDescriptor + "?api-version=5.0-preview.1");

    if(typeof(auth) == 'undefined'){
      // Nope
      $("#error-text").html("You must be a member of 'Product Administrators' to edit the product database.");
    }else{
      //User is authorized
      $("#menubar").removeAttr("hidden");
      //authorized = true;
    }
  });
}

grid = Controls.create(Grids.Grid, $("#productTree"), gridOptions);
loadGridFromDB();
VSS.ready(checkUserAccess);