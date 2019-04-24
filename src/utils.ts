import { docI } from "ProductSelector"

// TODO, move this function to something like "utils"
export function getDoc(file : string, scopeType? : string) : Promise<docI>{
    var scope : string = "Default";
    if (scopeType != undefined){
        scope = scopeType;
    }
    return new Promise(function(resolve, reject)
    {
        VSS.getService(VSS.ServiceIds.ExtensionData).then(function(dataService : IExtensionDataService) {
            // Get document by id
            dataService.getDocument(VSS.getWebContext().project.id, file, {scopeType: scope}).then(function(file : docI) {
            resolve(file);
            }, function (err){
            reject(err); // test for err.status == 404
            });
        });
    });
}

export function setDoc(file : string, contents : any, forceSet? : boolean, etag? : number, scopeType?: string) : Promise<docI> { 
    var scope : string = "Default";
    if (scopeType != undefined){
        scope = scopeType;
    }

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
        dataService.setDocument(VSS.getWebContext().project.id, myDoc,{scopeType: scope}).then(function(doc : docI) {
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