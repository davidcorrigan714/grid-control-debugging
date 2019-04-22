/// <reference types="vss-web-extension-sdk" />
import { productTreeI, productEntryI, docI, AreaQueriesI, allProductsDocI } from "ProductSelector";
import { getDoc } from "./utils";
import { Index } from "lunr";
import { MenuBarOptions, MenuBar } from "VSS/Controls/Menus";
import { CommandEventArgs } from "VSS/Events/Handlers";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";
import { create } from "VSS/Controls";

var products : productTreeI[] = [];
var flatProducts : productTreeI[] = [];
var recentProducts : productEntryI[] = [];
var idx : Index;
var parentProductKeys : string[] = [];
var isChild : boolean = false;
var onlyPublic : boolean = false;

function getAreaId() : Promise<number>
{
    return new Promise(function(resolve, reject)
    {
        WorkItemFormService.getService().then(function (service : IWorkItemFormService){
            service.getFieldValue("Area ID").then( function (obj : number){
                resolve(obj);
            }, function (err){
                reject(err);
            });
        }, function (err) {
            reject(err);
        });
    });
}

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

// Might find a longer name for this function
function addAllProductsToSearchPage() : void {
    var toAdd:string = "";
    for(var x : number = 0;x<products.length;x++){
        if(isChild){
            if(parentProductKeys.indexOf(products[x].key.split(',')[0]) >= 0)
            {
                toAdd += "<option value=\"" + x + "\">" + products[x].name + "</option>";
            }
        }else{
            toAdd += "<option value=\"" + x + "\">" + products[x].name + "</option>";
        }
        
    }
    $("#products").append(toAdd);
}

$("#searchQuery").on('input',function (){
    runSearch($(this).val());
});

function runSearch( query : string) : void 
{
    $("#products").empty();
    $("#products2").empty();

    if(query == ''){
        addAllProductsToSearchPage();
    }else{
        var results : lunr.Index.Result[] = idx.search(query);
        results.sort(resultsSort);

        var length = results.length;
        if(length > 100){
            length = 100;
        }

        var usedKeys :string[] = [];

        for(var i = 0;i<length;i++){
            var rootKey:string = flatProducts[results[i].ref].key.split(',')[0];
            if(isChild && parentProductKeys.indexOf(rootKey) == -1){
                continue;
            }

            if(onlyPublic && !isPublicProduct(rootKey))
                continue;

            if(usedKeys.indexOf(rootKey) < 0){
                usedKeys.push(rootKey);
                for(var x = 0;x<products.length;x++){
                    if(products[x].key == rootKey){
                        $("#products").append("<option value=\"" + x + "\">" + products[x].name + "</option>");
                        break;
                    }
                }
            }
        }

        if(length > 0){
            $("#products").val($("#products option:first").val()).change();
        }
    }
}

$("#products").on('change', function(){
    $("#products2").empty();
    var product : productTreeI = products[$("#products").val()];
    if(product == undefined){
        console.warn("Bad selection");
        return;
    }
    if(product.hidden !== true){
        $("#products2").append("<option value='" +
            JSON.stringify({name: product.name, key: product.key})
            + "'>" + product.name + "</option>");
    }
    if(product.children !== undefined)
    {
        product.children.forEach( function(c : productEntryI){
            $("#products2").append("<option value='" +
                JSON.stringify({name: product.name + ": " + c.name, key: product.key + "," + c.key})
                + "'>" + c.name + "</option>");
        });
    }
});

$("#products2").on('change',function (){
    var selectedProducts : productTreeI[] = [];
    for(var i in $("#products2").val()){
        selectedProducts.push(JSON.parse($("#products2").val()[i]) );
    }
    $("#selected-products").html(JSON.stringify(selectedProducts));
});

$("#recent-products").on('change', function(){
    var selectedProducts : productTreeI[] = [];
    for(var i in $("#recent-products").val()){
        selectedProducts.push({name: recentProducts[$("#recent-products").val()[i]].name,key:recentProducts[$("#recent-products").val()[i]].key, children: []})
    }
    $("#selected-products").html(JSON.stringify(selectedProducts));
});

function isPublicProduct (product : string) : boolean
{
    if(product[0] == 'p')
        return true;
    return false;
}

function reloadRecentList()
{
    $('#recent-products').empty();
    for(var i in recentProducts){
         if(isChild){
            if( parentProductKeys.indexOf(recentProducts[i].key.split(',')[0]) >= 0 ){
                continue;
            }
        }

        if(onlyPublic && !isPublicProduct(recentProducts[i].key))
            continue;
        
        $('#recent-products').append("<option value=\"" + i + "\">" + recentProducts[i].name + "</option>");
    }
}

// Called once the VSS extension API is ready
async function loadData(){
    var AreaId :number = 0;
    await getAreaId().then(function (id: number) : void {
        AreaId = id;
    }).catch(function (err){
        console.log("Area ID Failed to load: ");
        console.log(err);
        // TODO, disable interaction & saving
        return;
    });

    var defaultQuery : string = '';

    await getDoc("areaQueries").then( function (areaQueriesDoc : docI) {
        var areaQueryList : AreaQueriesI[] = areaQueriesDoc.data;
        for(var i in areaQueryList)
        {
            if(areaQueryList[i].id == AreaId){
                defaultQuery = areaQueryList[i].query;
                $("#searchQuery").val(defaultQuery);
                break;
            }
        }
    }).catch( function (err){
        console.log("Area queries failed to load: ");
        console.log(err);
        // TODO, disable interaction & saving
        return;
    });

    getDoc("allproducts").then( function (rawData : docI) {
        var data : allProductsDocI = rawData.data;
        products = JSON.parse(data.products);

        products.forEach(function (product : productTreeI){
            flatProducts.push({name: product.name, key:product.key, children: []})
            if(product.children){
                product.children.forEach(function (child : productTreeI) {
                    flatProducts.push({name: product.name + ": " + child.name, key:product.key + "," + child.key, children: []})
                });
            }
        });

        idx = Index.load(JSON.parse(data.idx));

        runSearch(defaultQuery);

        VSS.notifyLoadSucceeded();
    });

    getDoc("recent","User").then((recents) =>{
        recentProducts = recents.data;
        reloadRecentList();
    }).catch( () => {
        // Do nothing
    })
}

var menubarOptions : MenuBarOptions = {
    items: [
        { id: "recent", text: "Recent",  noIcon: true  },
        { separator: true },
        { id: "search", text: "Search", noIcon: true }
        ],
    executeAction: function (args : CommandEventArgs) {
        var command = args.get_commandName();
        switch (command) {
            case "recent":
                $("#recent-page").removeAttr("hidden");
                $("#search-page").attr("hidden","");
                $("select option:selected").prop("selected", 0);
                $('#selected-products').html("");
                break;
            case "search":
                $("#recent-page").attr("hidden","");
                $("#search-page").removeAttr("hidden");
                $("select option:selected").prop("selected", 0);
                $('#selected-products').html("");
                break;
            default:
                alert("Unhandled action: " + command);
                break;
        }
    }
};
// From Controls
create(MenuBar, $("#menubar"), menubarOptions);

function childPropertiesUpdated()
{
    if(isChild){
        reloadRecentList();
        runSearch($("#searchQuery").val());
    }
}

var selectorDialog = (function(id) {
    return {
        setChildProperties : function setChildProperties(isChild1 : boolean, parentProductKeys1, onlyPublicProducts : boolean){
            isChild = isChild1;
            parentProductKeys = parentProductKeys1;
            onlyPublic = onlyPublicProducts;
            childPropertiesUpdated();
        },
        getFormData: function() {
            return $("#selected-products").html();
        }
    };
})();

// Register form object to be used across this extension
VSS.register("form-selector-dialog", selectorDialog);
VSS.ready(loadData);
