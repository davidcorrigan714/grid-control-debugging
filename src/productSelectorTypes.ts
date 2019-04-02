declare module "ProductSelector" {
    interface productTreeI {
        name: string; // name
        key: string; // key
        children: Array<productTreeI>; //children
    }

    interface productEntryI {
        name: string; // name
        key: string; // key
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

