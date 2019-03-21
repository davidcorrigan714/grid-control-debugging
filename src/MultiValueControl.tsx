import { ITag, TagPicker } from "office-ui-fabric-react/lib/components/pickers";
import * as React from "react";

interface IMultiValueControlProps {
    selected?: {name: string, key: string}[];
    width?: number;
    readOnly?: boolean;
    onTagsChanged?: (tags: {name: string, key: string}[]) => Promise<void>;
    onAddProduct?: () => Promise<void>;
    forceValue?: boolean;
    options: {name: string, key: string}[];
    error: JSX.Element;
    onBlurred?: () => void;
    onResize?: () => void;
}

interface IMultiValueControlState {
    focused: boolean;
    filter: string;
}

export class MultiValueControl extends React.Component<IMultiValueControlProps, IMultiValueControlState> {

    constructor(props, context) {
        super(props, context);
        this.state = { focused: false, filter: "" };
    }

    public render() {
        const {focused} = this.state;
        return <div className={`multi-value-control ${focused ? "focused" : ""}`}>
            <TagPicker
                className="tag-picker"
                selectedItems={this.props.selected || []}
                inputProps={{
                    readOnly: this.props.readOnly,
                    width: this.props.width || 150,
                    onFocus: () => this.setState({ focused: true })
                }}
                onChange={this._onTagsChanged}
                onResolveSuggestions={() => []}
                />
            <button onClick={this._onAddProduct}>Add Product</button>
            <div className="error">{this.props.error}</div>
        </div>;
    }

    private _onAddProduct = async (): Promise<void> => {
        if (!this.props.onAddProduct) {
            return;
        }
        await this.props.onAddProduct();
    }

    public componentDidUpdate() {
        if (this.props.onResize) {
            this.props.onResize();
        }
    }

    private _onTagsChanged = (tags: ITag[]) => {
        if (this.props.onTagsChanged) {
            this.props.onTagsChanged(tags);
        }
    }
}
