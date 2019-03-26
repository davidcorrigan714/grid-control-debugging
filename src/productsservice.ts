/// <reference types="vss-web-extension-sdk" />

import * as WitExtensionContracts from "TFS/WorkItemTracking/ExtensionContracts";

interface flatProductTreeI {
    name: string;
    key: string;
    children: Array<flatProductTreeI>;
}

interface productTreeI {
    n: string; // name
    k: string; // key
    c: Array<productTreeI>; //children
}

interface productEntryI {
    name: string;
    key: string;
}

interface allProductsDocI {
    idx: string;
    products: [productTreeI];
}

let ProductTree: Array<productTreeI> = [];
let FlatProducts: Array<flatProductTreeI> = [];
let RecentProducts: Array<productEntryI> = [];
let ProductIdx: string = ''; // Search index for lunr
let Loaded: boolean = false;

function getDoc(file: string) : Promise<any>
{
    return new Promise<any>((resolve, reject) => {
        VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService: IExtensionDataService) {
            // Get document by id
            dataService.getDocument("ProductCollection", file).then(function(file) {
              resolve(file.data);
            }, function (err){
              reject(err);
            });
        });
    });
}

function load() : Promise<{recentProducts: Array<productEntryI>, productTree: Array<productTreeI>, flatProducts: Array<flatProductTreeI>, productIdx: string}>
{
    return new Promise<any>((resolve , reject) => {
        Promise.all([getDoc('allproducts'),VSS.getService(VSS.ServiceIds.ExtensionData) ]).then((results:[allProductsDocI,IExtensionDataService]) => {
            return Promise.all([results, results[1].getDocument("ProductCollection", "recent", {scopeType: "User"})]).then ((results:[[allProductsDocI,IExtensionDataService],any]) =>{
                var data = results[0][0];
                //var dataService: IExtensionDataService = results[0][1];
                let recentProducts: Array<productEntryI> = results[1].data;
                let productTree: Array<productTreeI> = data.products;
                let flatProducts: Array<flatProductTreeI> = [];
                let productIdx: string  = data.idx;
    
                for(var i in productTree){
                    if(productTree[i]){
                        flatProducts.push({name: productTree[i].n, key:productTree[i].k + ";", children: []})
                        for(var x in productTree[i].c){
                            flatProducts.push({name: productTree[i].n + ": " + productTree[i].c[x].n, key:productTree[i].k + "," + productTree[i].c[x].k + ";", children: []})
                        }
                    }
                }
                resolve({recentProducts: recentProducts, productTree: productTree, flatProducts: flatProducts, productIdx: productIdx});
            });
        });
    });
}

load().then(function (results: {recentProducts: Array<productEntryI>, productTree: Array<productTreeI>, flatProducts: Array<flatProductTreeI>, productIdx: string}) {
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
        dataService.setDocument("ProductCollection", myDoc, {scopeType: "User"});
    }); 
}

const provider = () => {
    return {
        updateRecentProducts: (products : Array<productEntryI>) =>
        {
            var found:boolean;
            for( var i = products.length - 1; i > 0; i--){
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
            RecentProducts.splice(50);
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