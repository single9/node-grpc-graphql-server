import { Controller } from '../../src';

describe('Test Controller', () => {
  let controller: Controller;

  it('should create an instance of Controller', (done) => {
    controller = new Controller();

    expect(controller).toBeDefined();
    expect(controller).toHaveProperty('response');
    done();
  });

  it('should return data via callback', (done) => {
    controller.response({ test: 'value' }, (err, data) => {
      expect(err).toBeNull();
      expect(data).toHaveProperty('test', 'value');

      done();
    });
  });

  it('should return error via callback', (done) => {
    controller.response(new Error('TestError'), (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('should return data via promise', async () => {
    const data = await controller.response({ test: 'value' });

    expect(data).toBeDefined();
    expect(data).toHaveProperty('test', 'value');
  });

  it('should return error via promise', async () => {
    await expect(controller.response(new Error('TestError'))).rejects.toThrow(
      'TestError',
    );
  });
});
