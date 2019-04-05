declare module "ProductSelector" {
    interface productTreeI {
        name: string;
        key: string;
        hidden?: boolean;
        children?: Array<productTreeI>;
    }

    interface productEntryI {
        name: string;
        key: string;
    }
    
    interface allProductsDocI {
        idx: string;
        products: [productTreeI];
    }

    interface productDBI
    {
        productTree: Array<productTreeI>;
        flatProducts: Array<productTreeI>;
        recentProducts: Array<productTreeI>;
        productIdx : string;
    }

    class productSelectorService {
        getProductDB() : Promise<productDBI>;
    }
}

