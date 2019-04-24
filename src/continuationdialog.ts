/// <reference types="vss-web-extension-sdk" />

var selectorDialog = (function(id) {
    return {
        setChildProperties : function setChildProperties(parentFieldName: string, text: string){
            $("#titleText").text("Would you like to add the following products to " + parentFieldName + "?");
            $("#additionalProducts").html(text);
        },
        getFormData: function() {
            return '';
        }
    };
})();

// Register form object to be used across this extension
VSS.register("continue-products-dialog", selectorDialog);
VSS.notifyLoadSucceeded();