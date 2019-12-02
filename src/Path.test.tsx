import {getValueFromObject,setValueOnObject} from './form/helpers';
interface PersonData {
    firstname: string;
    lastname: string;
}

interface Price {
    currency: string;
    amount: number;
}

interface OrderItem {
    description: string;
    price: Price;
    partPrices: Price[];
}

interface Order {
    id: number;
    personData: PersonData;
    items: OrderItem[];
}

const SOME_PRICE = {
    amount: 12,
    currency: 'USD'
};
const SOME_OTHER_PRICE = {
    amount: 15,
    currency: 'EUR'
};

const testData = () => {
    return {
        id: 1,
        items: [{
            description: 'first Item',
            partPrices: [
                SOME_OTHER_PRICE,
                SOME_PRICE
            ],
            price: SOME_PRICE

        }],
        personData: {
            firstname: 'test',
            lastname: 'lasttest'
        }
    }
}



it('can access basic props', () => {
    expect(getValueFromObject('id', testData())).toEqual(1);
});
it('can access array props', () => {
    const res = getValueFromObject('items[0].description', testData());
    console.log('res ', res);
    expect(res).toEqual('first Item');
});
it('can access nested props', () => {
    const res = getValueFromObject('items[0].price.currency', testData());
    expect(res).toEqual('USD');
});
it('can access nested array\'s props', () => {
    const res = getValueFromObject('items[0].partPrices[0].currency', testData());
    expect(res).toEqual('EUR');
});

it('can modify basic props', () => {
    helperTestSetValueOnObject('id', 2);
});
it('can modify array props', () => {
    helperTestSetValueOnObject('items[0].description', 'new description');
});
it('can modify nested props', () => {
    helperTestSetValueOnObject('items[0].price.currency', 'GBP');
});
it('can modify nested array\'s props', () => {
    helperTestSetValueOnObject('items[0].partPrices[0].currency', 'GBP');
});
it('can set non existant props', () => {
    const res = testData();
    setValueOnObject('items.test', res , 'test');
    expect(getValueFromObject('items.test', res)).toEqual('test');
});
// it('can set non existant props', () => {
//     const res = testData();
//     setValueOnObject('items[5].price.currency', res , 'test');
//     expect(getValueFromObject('items[5].price.currency', res)).toEqual('test');
// });

function helperTestSetValueOnObject(path: string, newValue: any) {
    const res = testData();
    setValueOnObject(path, res , newValue);

    expect(getValueFromObject(path, res)).toEqual(newValue);
}