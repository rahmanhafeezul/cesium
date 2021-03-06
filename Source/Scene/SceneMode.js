/*global define*/
define(['../Core/Enumeration'], function(Enumeration) {
    "use strict";

    /**
     * DOC_TBA
     *
     * @exports SceneMode
     */
    var SceneMode = {
        /**
         * DOC_TBA
         *
         * @constant
         * @type {Enumeration}
         */
        SCENE2D : new Enumeration(0, 'SCENE2D', {
            morphTime : 0.0
        }),

        /**
         * DOC_TBA
         *
         * @constant
         * @type {Enumeration}
         */
        COLUMBUS_VIEW : new Enumeration(1, 'COLUMBUS_VIEW', {
            morphTime : 0.0
        }),

        /**
         * DOC_TBA
         *
         * @constant
         * @type {Enumeration}
         */
        SCENE3D : new Enumeration(2, 'SCENE3D', {
            morphTime : 1.0
        }),

        /**
         * DOC_TBA
         *
         * @constant
         * @type {Enumeration}
         */
        MORPHING : new Enumeration(3, 'MORPHING')
    };

    return SceneMode;
});