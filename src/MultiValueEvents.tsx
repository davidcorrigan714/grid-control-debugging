import { initializeIcons } from "office-ui-fabric-react/lib/Icons";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";
import { MultiValueControl } from "./MultiValueControl";
import { productEntryI, docI } from "ProductSelector";
import { getDoc, setDoc } from "./utils";

initializeIcons();
const HELP_URL = "https://github.com/Microsoft/vsts-extension-multivalue-control#azure-devops-services";

export class MultiValueEvents {
    public readonly fieldName = VSS.getConfiguration().witInputs.FieldName;
    public readonly fieldDataName = VSS.getConfiguration().witInputs.FieldNameKey;
    private readonly _container = document.getElementById("container") as HTMLElement;
    private _onRefreshed: () => void;
    /** Counter to avoid consuming own changed field events. */
    private _fired: number = 0;
    private _tags: {name: string, key: string}[] = [];
    private parentFieldId : string = '';

    public async refresh(tags?: {name: string, key: string}[]): Promise<void> {
        let error = <></>;
        if (!tags) {
            if (this._fired) {
                this._fired--;
                if (this._fired !== 0) {
                    return;
                }
                error = await this._checkFieldType();
                if (!error) {
                    return;
                }
            }
            this._tags = await this._getTags();
        }else{
            this._tags = tags;
        }

        ReactDOM.render(<MultiValueControl
            selected={this._tags}
            options={this._tags}
            onTagsChanged={this._setTags}
            width={this._container.scrollWidth-50}
            onResize={this._resize}
            error={error}
            onAddProduct={this.showProductSelector}
        />, this._container, () => {
            this._resize();
            if (this._onRefreshed) {
                this._onRefreshed();
            }
        });
    }

    private async updateRecentProducts (products : productEntryI[]) : Promise<void> 
    {
        getDoc("recent","User").then((recents : docI) =>{
            var recentProducts : productEntryI[] = recents.data;

            var found: boolean;
            for( var i = products.length - 1; i >= 0; i--){
                found = false;
                for(var x in recentProducts)
                {
                    if(products[i].key == recentProducts[x].key)
                    {
                        found = true;
                        recentProducts.splice(parseInt(x),1);
                        recentProducts.unshift(products[i]);
                        break;
                    }
                }
                if(!found){
                    recentProducts.unshift(products[i]);
                }
            }
            recentProducts.splice(17);
            setDoc("recent", recentProducts, true, -1, "User");
        });
    }

    private showProductSelector = (): Promise<void> => {
        var selectorForm;

        var isChild : boolean = VSS.getConfiguration().witInputs.FieldIsChild;
        var parentProductKeys : {name: string, key: string}[] = [];

        if (isChild){
            var parentField = VSS.getConfiguration().witInputs.ParentField;
            this.parentFieldId = parentField;
   
            WorkItemFormService.getService().then((service : IWorkItemFormService) => {
                service.getFieldValue(parentField).then( (obj : string) => {
                    obj = this.decodeHTMLEntities(obj);
                    parentProductKeys = JSON.parse(obj);
                }, function (err){
                    parentProductKeys = []
                });
            }, function (err) {
                parentProductKeys = []
            });
        }

        var dialogOptions : IHostDialogOptions = {
            title: "Product Selection",
            width: 700,
            height: 480,
            getDialogResult: function() {
                // Get the result from selectorForm object
                return selectorForm ? selectorForm.getFormData() : null;
            },
            okCallback: (result) => {
                // TODO abstract this type
                var results : {selected: productEntryI[], additional: productEntryI[], additionalComplete: productEntryI[]}
                     = {selected: result.selected, additional: result.additional, additionalComplete: result.additionalComplete};

                for(var x in results.selected){
                    var found = false;
                    for(var i = 0; i < this._tags.length; i++) {
                        if (this._tags[i].key == results.selected[x].key) {
                            found = true;
                            break;
                        }
                    }
                    if (!found){
                        this._tags.push({key: results.selected[x].key, name: results.selected[x].name});
                    }
                }

                this.updateRecentProducts(results.selected);
                this._setTags(this._tags);

                if(results.additional.length > 0)
                {
                    this.doContinuationDialog(results.additional, results.additionalComplete);
                }
            }
        };

        var extensionCtx = VSS.getExtensionContext();
        var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".form-selector-dialog";

        VSS.getService<IHostDialogService>(VSS.ServiceIds.Dialog).then((dialogService) => {
            dialogService.openDialog(contributionId,dialogOptions).then((dialog) => {
                dialog.getContributionInstance("form-selector-dialog").then(function (selectorFormInstance ) {
                    var onlyPublicProducts = VSS.getConfiguration().witInputs.OnlyPublic;
                    if(isChild || VSS.getConfiguration().witInputs.OnlyPublic)
                    {
                        //@ts-ignore Might be a decent idea to properly type this call
                        selectorFormInstance.setChildProperties(isChild, parentProductKeys, onlyPublicProducts);
                    }
                    dialog.updateOkButton(true);
                    selectorForm = selectorFormInstance;
                });
            });
        });

        return new Promise<void>((resolve) => {
            this._onRefreshed = resolve;
        });
    }

    private  doContinuationDialog  = async ( additionalProducts: productEntryI[], additionalProductsComplete: productEntryI[]):  Promise<void> => {
        var dialogOptions : IHostDialogOptions = {
            title: "Additional Products",
            width: 400,
            height: 300,
            getDialogResult: function() {
                // Get the result from selectorForm object
            },
            okCallback: (result) => {
                var names : string[] = [];
                additionalProductsComplete.forEach( product => {names.push(product.name);});
                WorkItemFormService.getService().then((service : IWorkItemFormService) => {
                    service.setFieldValue(this.parentFieldId, JSON.stringify(additionalProductsComplete));
                });
            }
        };

        var extensionCtx = VSS.getExtensionContext();
        var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".continue-products-dialog";
        var productNames : string[] = [];
        additionalProducts.forEach(product => {productNames.push(product.name);});

        VSS.getService<IHostDialogService>(VSS.ServiceIds.Dialog).then((dialogService) => {
            dialogService.openDialog(contributionId,dialogOptions).then((dialog) => {
                dialog.getContributionInstance("continue-products-dialog").then(function (selectorFormInstance ) {
                    // @ts-ignore Should probably type the form instance at some point
                    selectorFormInstance.setChildProperties(VSS.getConfiguration().witInputs.ParentFieldTitle,productNames.join(", "));
                    dialog.updateOkButton(true);
                });
            });
        });

    }

    private _resize = () => {
        VSS.resize(this._container.scrollWidth || 200, this._container.scrollHeight || 40);
    }
    private async _getTags(): Promise<{name: string, key: string}[]> {
        const formService = await WorkItemFormService.getService();
        const value = await formService.getFieldValue(this.fieldDataName);
        if (typeof value !== "string") {
            return [];
        }
        if(value.length == 0){
            return [];
        }
        return JSON.parse(this.decodeHTMLEntities(value));
    }
    private _setTags = async (tags: {name: string, key: string}[]): Promise<void> => {
        this.refresh(tags);
        this._fired++;
        const formService = await WorkItemFormService.getService();

        await formService.setFieldValue(this.fieldName, tags.map(({name}) => name).join(" ; "));
        await formService.setFieldValue(this.fieldDataName, JSON.stringify(tags));

        return new Promise<void>((resolve) => {
            this._onRefreshed = resolve;
        });
    }

    private decodeHTMLEntities(html: string): string {
        var entities = [
            ['amp', '&'],
            ['apos', '\''],
            ['#x27', '\''],
            ['#x2F', '/'],
            ['#39', '\''],
            ['#47', '/'],
            ['lt', '<'],
            ['gt', '>'],
            ['nbsp', ' '],
            ['quot', '"']
        ];
    
        for (var i = 0, max = entities.length; i < max; ++i) 
            html = html.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1]);

        return html;
    }

    private async _checkFieldType(): Promise<JSX.Element> {
        const formService = await WorkItemFormService.getService();
        const inv = await formService.getInvalidFields();
        if (inv.length > 0 && inv.some((f) => f.referenceName === this.fieldName)) {
            const field = await getClient().getField(this.fieldName);
            if (field.isPicklist) {
                return <div>
                    {`Set the field ${field.name} to use suggested values rather than allowed values. `}
                    <a href={HELP_URL} target="_blank">{"See documentation"}</a>
                </div>;
            }
        }
        return <></>;
    }
}
