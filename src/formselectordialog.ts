/// <reference types="vss-web-extension-sdk" />
import * as PS from "ProductSelector";
import * as lunr from "lunr";
import * as Menus from "VSS/Controls/Menus";
import { CommandEventArgs } from "VSS/Events/Handlers";
import * as Controls from "VSS/Controls";

var products : Array<PS.productTreeI> = [];
var flatProducts : Array<PS.productTreeI> = [];
var recentProducts : Array<PS.productEntryI> = [];
var idx : lunr.Index;

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
        toAdd += "<option value=\"" + x + "\">" + products[x].name + "</option>";
    }
    $("#products").append(toAdd);
}

$("#searchQuery").on('input',function (){
    $("#products").empty();
    $("#products2").empty();

    if($(this).val() == ''){
        addAllProductsToSearchPage();
    }else{
        var results : Array<lunr.Index.Result> = idx.search($(this).val());
        results.sort(resultsSort);

        var length = results.length;
        if(length > 100){
            length = 100;
        }

        var usedKeys :Array<string> = [];

        for(var i = 0;i<length;i++){
            var rootKey:string = flatProducts[results[i].ref].key.split(',')[0];
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
});

$("#products").on('change', function(){
    $("#products2").empty();
    $("#products2").append("<option value='" +
            JSON.stringify({name: products[$("#products").val()].name, key: products[$("#products").val()].key})
            + "'>" + products[$("#products").val()].name + "</option>");
    var productIndex = $("#products").val();
    for(var i in products[productIndex].children){
        $("#products2").append("<option value='" +
            JSON.stringify({name: products[productIndex].name + ": " + products[productIndex].children[i].name, key: products[productIndex].key + "," + products[productIndex].children[i].key})
            + "'>" + products[productIndex].children[i].name + "</option>");
    }
});

$("#products2").on('change',function (){
    var selectedProducts : Array<PS.productTreeI> = [];
    for(var i in $("#products2").val()){
        selectedProducts.push(JSON.parse($("#products2").val()[i]) );
    }
    $("#selected-products").html(JSON.stringify(selectedProducts));
});

$("#recent-products").on('change', function(){
    var selectedProducts : Array<PS.productTreeI> = [];
    for(var i in $("#recent-products").val()){
        selectedProducts.push({name: recentProducts[$("#recent-products").val()[i]].name,key:recentProducts[$("#recent-products").val()[i]].key, children: []})
    }
    $("#selected-products").html(JSON.stringify(selectedProducts));
});

// Called once the VSS extension API is ready
function loadData(){
    var extensionCtx = VSS.getExtensionContext();
    var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".form-products-service";
    VSS.getServiceContribution(contributionId).then( function (contributionObj : IServiceContribution ){
        contributionObj.getInstance().then(function (instanceObj : PS.productSelectorService){
            instanceObj.getProductDB().then(function (productDB : PS.productDBI){
            products = productDB.productTree;
            flatProducts = productDB.flatProducts;
            recentProducts = productDB.recentProducts;

            for(var i in recentProducts){
                $('#recent-products').append("<option value=\"" + i + "\">" + recentProducts[i].name + "</option>");
            }

            addAllProductsToSearchPage();

            VSS.notifyLoadSucceeded();

            idx = lunr.Index.load(JSON.parse(productDB.productIdx));
            });
        });
    });
}

VSS.ready(loadData);

var menubarOptions : Menus.MenuBarOptions = {
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
Controls.create(Menus.MenuBar, $("#menubar"), menubarOptions);

var selectorDialog = (function(id) {
    return {
        getFormData: function() {
            return $("#selected-products").html();
        }
    };
})();

// Register form object to be used across this extension
VSS.register("form-selector-dialog", selectorDialog);