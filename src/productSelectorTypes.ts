declare module "ProductSelector" {
    export interface productTreeI {
        name: string;
        key: string;
        hidden?: boolean;
        children?: Array<productTreeI>;
    }

    export interface productEntryI {
        name: string;
        key: string;
    }
    
    export interface allProductsDocI {
        idx: string;
        products: string;
    }

    export interface productDBI
    {
        productTree: Array<productTreeI>;
        flatProducts: Array<productTreeI>;
        recentProducts: Array<productTreeI>;
        productIdx : string;
    }
    
    export interface docI {
        id: string;
        __etag: number;
        data: any;
    }

    export interface AreaQueriesI {
        id: number;
        query: string;
    }
}
