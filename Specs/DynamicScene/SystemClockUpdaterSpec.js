/*global defineSuite*/
defineSuite([
         'DynamicScene/SystemClockUpdater',
         'DynamicScene/CzmlProcessor',
         'DynamicScene/DynamicObjectCollection',
         'DynamicScene/DynamicExternalDocument',
         'Core/JulianDate',
         '../Specs/createScene',
         '../Specs/destroyScene',
         '../Specs/MockProperty'
     ], function(
             SystemClockUpdater,
             CzmlProcessor,
             DynamicObjectCollection,
             DynamicExternalDocument,
             JulianDate,
             createScene,
             destroyScene,
             MockProperty) {
    "use strict";
    /*global jasmine,describe,xdescribe,it,xit,expect,beforeEach,afterEach,beforeAll,afterAll,spyOn,runs,waits,waitsFor*/

    var scene;

    beforeAll(function() {
        scene = createScene();
    });

    afterAll(function() {
        destroyScene(scene);
    });

    var fakeEventSource;
    var fakeEventSourceConstructor;
    var dynamicObjectCollection;
    var processor;

    beforeEach(function() {
        fakeEventSource = jasmine.createSpyObj('EventSource', ['close']);
        fakeEventSourceConstructor = spyOn(window, 'EventSource').andReturn(fakeEventSource);

        dynamicObjectCollection = new DynamicObjectCollection();
        processor = new CzmlProcessor(scene);
    });

    it('SystemClockUpdater throws with empty arguments.', function() {
        expect(function() {
            return new SystemClockUpdater();
        }).toThrow();
    });

    it('SystemClockUpdater throws with out dynamicObjectCollection and baseUrl', function() {
        expect(function() {
            return new SystemClockUpdater({});
        }).toThrow();
    });

    it('SystemClockUpdater throws with out baseUrl', function() {
        expect(function() {
            return new SystemClockUpdater({}, {});
        }).toThrow();
    });

    it('update calls the CzmlProcessor process function.', function() {
        var testObject = dynamicObjectCollection.getOrCreateObject('test');
        testObject.external = new DynamicExternalDocument();
        var eventSourceUrl = 'localhost/eventsource';
        testObject.external.polling = new MockProperty(eventSourceUrl);
        testObject.external.refreshInterval = new MockProperty(0.0001);

        var updater = new SystemClockUpdater(processor, dynamicObjectCollection, testObject.external.polling, testObject.external.refreshInterval);
        var date = new Date();
        var curDate = null;

        do { curDate = new Date(); }
        while(curDate-date < 20);
        updater.update(new JulianDate());
        spyOn(processor, 'process');

        fakeEventSource.onmessage({
            data : '{"test":"value"}'
        });

        expect(processor.process).toHaveBeenCalledWith({
            test : 'value'
        }, dynamicObjectCollection, eventSourceUrl);
        expect(fakeEventSourceConstructor).toHaveBeenCalledWith(eventSourceUrl);
    });

    it('abort closes handle.', function() {
        var testObject = dynamicObjectCollection.getOrCreateObject('test');
        testObject.external = new DynamicExternalDocument();
        testObject.external.polling = new MockProperty('localhost');
        testObject.external.refreshInterval = new MockProperty(0.0001);

        var updater = new SystemClockUpdater(processor, dynamicObjectCollection, testObject.external.polling, testObject.external.refreshInterval);
        var date = new Date();
        var curDate = null;

        do { curDate = new Date(); }
        while(curDate-date < 20);

        updater.update(new JulianDate());
        fakeEventSource.onmessage({data:"{\"test\":\"value\"}"});

        updater.abort();
        expect(fakeEventSource.close).toHaveBeenCalled();
    });
});