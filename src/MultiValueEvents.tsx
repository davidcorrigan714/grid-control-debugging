import { initializeIcons } from "office-ui-fabric-react/lib/Icons";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";
import { MultiValueControl } from "./MultiValueControl";

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

    private showProductSelector = (): Promise<void> => {
        var selectorForm;

        var isChild : boolean = VSS.getConfiguration().witInputs.FieldIsChild;
        var parentProductKeys : string[] = [];

        if (isChild){
            var parentField = VSS.getConfiguration().witInputs.ParentField;
   
            WorkItemFormService.getService().then(function (service : IWorkItemFormService){
                service.getFieldValue(parentField).then( function (obj : string){
                    var products : {name: string, key: string}[] = JSON.parse(obj);
                    products.forEach(p => {parentProductKeys.push(p.key.split(',')[0])})
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
                var results = JSON.parse(result);

                for(var x in results){
                    var found = false;
                    for(var i = 0; i < this._tags.length; i++) {
                        if (this._tags[i].key == results[x].key) {
                            found = true;
                            break;
                        }
                    }
                    if (!found){
                        this._tags.push({key: results[x].key, name: results[x].name});
                    }
                }

                // TODO, move this to productservice.ts, maybe called from formselectordialog.html
                var extensionCtx = VSS.getExtensionContext();
                var contributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".form-products-service";
                VSS.getServiceContribution(contributionId).then( function (contributionObj){
                    contributionObj.getInstance().then(function (instanceObj: any){ // TODO Get type from other ts file (?)
                        instanceObj.updateRecentProducts(results);
                    });
                });

                this._setTags(this._tags);
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
                        //@ts-ignore Might be a decent idea to properly type this call\
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
