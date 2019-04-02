/// <reference types="vss-web-extension-sdk" />

import * as WitExtensionContracts from "TFS/WorkItemTracking/ExtensionContracts";
import * as PS from "ProductSelector"

let ProductTree: Array<PS.productTreeI> = [];
let FlatProducts: Array<PS.productTreeI> = [];
let RecentProducts: Array<PS.productEntryI> = [];
let ProductIdx: string = ''; // Search index for lunr
let Loaded: boolean = false;

function getDoc(file: string) : Promise<any>
{
    return new Promise<any>((resolve, reject) => {
        VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService: IExtensionDataService) {
            // Get document by id
            dataService.getDocument(VSS.getWebContext().project.id, file).then(function(file) {
              resolve(file.data);
            }, function (err){
              reject(err);
            });
        });
    });
}

function load() : Promise<{recentProducts: Array<PS.productEntryI>, productTree: Array<PS.productTreeI>, flatProducts: Array<PS.productTreeI>, productIdx: string}>
{
    return new Promise<any>((resolve , reject) => {
        Promise.all([getDoc('allproducts'),VSS.getService(VSS.ServiceIds.ExtensionData) ]).then((results:[PS.allProductsDocI,IExtensionDataService]) => {
            var data = results[0];
            let productTree: Array<PS.productTreeI> = data.products;
            let flatProducts: Array<PS.productTreeI> = [];
            let productIdx: string  = data.idx;

            for(var i in productTree){
                if(productTree[i]){
                    flatProducts.push({name: productTree[i].name, key:productTree[i].key, children: []})
                    for(var x in productTree[i].children){
                        flatProducts.push({name: productTree[i].name + ": " + productTree[i].children[x].name, key:productTree[i].key + "," + productTree[i].children[x].key, children: []})
                    }
                }
            }

            results[1].getDocument(VSS.getWebContext().project.id, "recent", {scopeType: "User"}).then ((recents) =>{
                let recentProducts: Array<PS.productEntryI> = recents.data;
                resolve({recentProducts: recentProducts, productTree: productTree, flatProducts: flatProducts, productIdx: productIdx});
            }, () => {
                // Getting recent failed, which is fine
                resolve({recentProducts: [], productTree: productTree, flatProducts: flatProducts, productIdx: productIdx});
            }

            );
        });
    });
}

load().then(function (results: {recentProducts: Array<PS.productEntryI>, productTree: Array<PS.productTreeI>, flatProducts: Array<PS.productTreeI>, productIdx: string}) {
    RecentProducts = results.recentProducts;
    ProductTree = results.productTree;
    FlatProducts = results.flatProducts;
    ProductIdx = results.productIdx;
    Loaded = true;
});

function saveRecentProducts()
{
    VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService: IExtensionDataService) {
        // Prepare document first
        var myDoc = {
            id: "recent",
            data: RecentProducts,
            __etag: -1 //Ok with a set on this one
        };

        // TODO error catch
        dataService.setDocument(VSS.getWebContext().project.id, myDoc, {scopeType: "User"});
    }); 
}

const provider = () => {
    return {
        updateRecentProducts: (products : Array<PS.productEntryI>) =>
        {
            var found:boolean;
            for( var i = products.length - 1; i >= 0; i--){
                found = false;
                for(var x in RecentProducts)
                {
                    if(products[i].key == RecentProducts[x].key)
                    {
                        found = true;
                        RecentProducts.splice(parseInt(x),1);
                        RecentProducts.unshift(products[i]);
                        break;
                    }
                }
                if(!found){
                    RecentProducts.unshift(products[i]);
                }
            }
            RecentProducts.splice(17);
            saveRecentProducts();
        },
        getProductDB: () => {
            if(!Loaded){
                return load();
            }else{
                return new Promise<any>((resolve, reject) => {
                    resolve({productTree: ProductTree, flatProducts: FlatProducts, recentProducts: RecentProducts, productIdx: ProductIdx});
                });
            }
            
        },
        onLoaded: (args: WitExtensionContracts.IWorkItemLoadedArgs) => {
        },
        onFieldChanged: (args: WitExtensionContracts.IWorkItemFieldChangedArgs) => {
        },
    };
};

VSS.register(VSS.getContribution().id, provider);