import GraphQlBlock from '../../src/converter/graphql-block';
import { GqlBlockType, GqlType } from '../../src/converter/graphql-type';

let nums = 0;
function genRandomName() {
  return 'field_' + nums++;
}

describe('Test converter/graphql-block', () => {
  const typeBlock = new GraphQlBlock('type', 'typeBlock');
  const inputBlock = new GraphQlBlock('input', 'inputBlock');
  const enumBlock = new GraphQlBlock('enum', 'enumBlock');

  it('should create a typeBlock with `type` type and named typeBlock', (done) => {
    expect(typeBlock).toBeDefined();
    expect(typeBlock.type).toBe('type');

    done();
  });

  it('should create a inputBlock with `input` type and named inputBlock', (done) => {
    expect(inputBlock).toBeDefined();
    expect(inputBlock.type).toBe('input');

    done();
  });

  it('should create a enumBlock with `input` type and named enumBlock', (done) => {
    expect(enumBlock).toBeDefined();
    expect(enumBlock.type).toBe('enum');

    done();
  });

  [typeBlock, inputBlock, enumBlock].forEach((block) => {
    const data = [
      { fieldName: 'good_f1', type: GqlType.String },
      { fieldName: genRandomName(), type: GqlType.Boolean },
      { fieldName: genRandomName(), type: GqlType.Float },
      { fieldName: genRandomName(), type: GqlType.ID },
      { fieldName: genRandomName(), type: GqlType.Int },
    ];

    data.forEach((testData) => {
      it(`should add a ${testData.type} type field to ${block.name}`, (done) => {
        if (block.type === GqlBlockType.enum) {
          block.addField(testData.fieldName);
        } else {
          block.addField(testData.fieldName, { type: testData.type });
        }

        const field = block.getField(testData.fieldName);

        expect(field).toBeDefined();

        if (block.type !== GqlBlockType.enum) {
          expect(field.responseType).toBe(testData.type);
        }

        done();
      });
    });
  });
});
